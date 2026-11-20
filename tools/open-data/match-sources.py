#!/usr/bin/env python3
"""Match Coasterpedia (CC BY-SA 4.0) and OpenStreetMap (ODbL) coasters to ours,
the way match-wikidata.py does for Wikidata, and write
tools/open-data/sources-matches.json:

  items    every record from each source (matched or not): source, ref, name,
           park, lat, lon, and ALL its raw fields (infobox parameters / OSM tags)
  matches  [{source, ref, coaster_id, method, status}]  status 'linked' or
           'ambiguous' (kept for review, not linked)
  facts    [{coaster_id, source, ref, field, value, prec}]  in our units
           (ft, mph, seconds, YYYY[-MM[-DD]]), from linked records only

Matching: the names agree (squashed, racing sides share a record, "(Old)" and
a year stay distinct) AND the park agrees (its name or a former name, either
way contained) or the record's coordinates are within 3 km of our park.
Nothing is dropped for looking wrong (Carter, 2026-11-18). No RCDB identifier
is read or stored. Run from the repo root after the pulls."""
import collections, datetime, json, math, os, re, sys, unicodedata

def sq(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'^the\s+', '', s).replace('&', 'and')
    return re.sub(r'[^a-z0-9]', '', s)

def base(n):
    m = re.match(r'^(.*?)\s*\(([^)]*)\)\s*$', n or '')
    if not m or re.match(r'^(old|new|\d{4})$', m.group(2).strip(), re.I): return n or ''
    return m.group(1)

def km(a, b, c, d):
    r = math.pi / 180
    return 6371 * math.acos(max(-1, min(1, math.sin(a*r)*math.sin(c*r) + math.cos(a*r)*math.cos(c*r)*math.cos((b-d)*r))))

def num(v):
    m = re.search(r'-?\d[\d,]*(?:\.\d+)?', str(v or ''))
    return float(m.group(0).replace(',', '')) if m else None

MONTHS = {m: i + 1 for i, m in enumerate(['january', 'february', 'march', 'april', 'may', 'june', 'july',
          'august', 'september', 'october', 'november', 'december'])}
# German Wikipedia writes "18. Juni 2001".
MONTHS.update({m: i + 1 for i, m in enumerate(['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli',
               'august', 'september', 'oktober', 'november', 'dezember'])})
MONTHS['jänner'] = 1
def date(v):
    """'March 26, 1994' / '19 March 2005' / 'May 1998' / '2017' / '2017-05-03' -> (value, prec)."""
    v = (v or '').strip()
    # An ISO date, with a real month: "1948-1949" is a span, not month 19.
    m = re.match(r'^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?(?!\d)', v)
    if m: return (m.group(0), 'day' if m.group(3) else 'month')
    if re.match(r'^\d{4}\s*[-–]\s*\d{2,4}$', v): return (v[:4], 'year')
    t = re.sub(r'[,.]', ' ', v.lower()).split()
    mon = next((MONTHS[w] for w in t if w in MONTHS), None)
    yr = next((w for w in t if re.fullmatch(r'(18|19|20)\d\d', w)), None)
    if not yr: return None
    day = next((w for w in t if re.fullmatch(r'\d{1,2}', w) and 1 <= int(w) <= 31), None)
    if mon and day: return ('%s-%02d-%02d' % (yr, mon, int(day)), 'day')
    if mon: return ('%s-%02d' % (yr, mon), 'month')
    return (yr, 'year')

def secs(v):
    v = (v or '').strip().lower()
    m = re.match(r'^(\d+):(\d\d)', v)
    if m: return int(m.group(1)) * 60 + int(m.group(2))
    mm = re.search(r'(\d+(?:\.\d+)?)\s*(?:min|minutes?)', v); ss = re.search(r'(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)\b', v)
    if mm or ss: return int(round((float(mm.group(1)) * 60 if mm else 0) + (float(ss.group(1)) if ss else 0)))
    n = num(v)
    return int(round(n)) if n is not None else None

data = json.load(open('coasters.json')); coasters = data['coasters']
parks = json.load(open('parks.json'))
alias_by_c = collections.defaultdict(list)
for a in data.get('aliases', []): alias_by_c[a['c']].append(a['n'])
palias = collections.defaultdict(list)
for a in data.get('parkAliases', []): palias[a['p']].append(a['n'])
freq = collections.Counter(c['manu'] for c in coasters if c.get('manu'))
ours = sorted(freq, key=lambda m: (-len(sq(m)), -freq[m]))
def maker(v):
    s = sq(v)
    for m in ours:
        if sq(m) and (sq(m) in s or (len(s) > 4 and s in sq(m))): return m
    return v

# ---- the records ---------------------------------------------------------
items = []   # {source, ref, name, names, park, parks, lat, lon, raw, facts}

def cp_items():
    p = 'tools/open-data/coasterpedia/infoboxes.jsonl'
    if not os.path.exists(p): return
    for line in open(p):
        r = json.loads(line)
        # A broken infobox (an unclosed [[) can leave a whole block in one key.
        b = {k: re.sub(r'\s+', ' ', v) for k, v in r['params'].items() if re.fullmatch(r'[a-z0-9_/ .-]+', k) and 'rcdb' not in k and 'rcdb' not in v.lower()}
        title = r['title']
        name = b.get('name') or re.sub(r'\s*\([^)]*\)$', '', title)
        metric = (b.get('units') or 'metric').lower() != 'imperial'
        f = {}
        ft = lambda v: None if v is None else round(v * 3.28084, 1) if metric else v
        mph = lambda v: None if v is None else round(v * 0.621371, 1) if metric else v
        if num(b.get('height')) is not None: f['h'] = ft(num(b['height']))
        if num(b.get('length')) is not None: f['l'] = ft(num(b['length']))
        if num(b.get('speed')) is not None: f['s'] = mph(num(b['speed']))
        if b.get('inversions') and num(b['inversions']) is not None: f['inv'] = int(num(b['inversions']))
        if b.get('duration') and secs(b['duration']): f['dur'] = secs(b['duration'])
        for k in ('opened', 'closed'):
            d = date(b.get(k))
            if d: f[k] = d
        if b.get('manufacturer'): f['manu'] = maker(b['manufacturer'])
        prod = ' '.join(x for x in (b.get('product'), b.get('product_variant')) if x)
        if prod: f['model'] = prod
        mat = (b.get('track_material') or '').lower()
        if 'wood' in mat and 'steel' not in mat: f['type'] = 'Wood'
        elif 'steel' in mat or 'hybrid' in mat: f['type'] = 'Steel'
        names = [name, title, re.sub(r'\s*\([^)]*\)$', '', title)] + [b[k] for k in b if re.fullmatch(r'name\d', k)]
        items.append(dict(source='coasterpedia', ref=title, name=name, park=b.get('park'),
                          names={sq(n) for n in names if n}, parks={sq(b.get('park') or '')} - {''},
                          lat=num(b.get('coord_lat')), lon=num(b.get('coord_long')), raw=b, facts=f))

def osm_items():
    p = 'tools/open-data/osm/coasters.json'
    if not os.path.exists(p): return
    for e in json.load(open(p))['elements']:
        t = {k: re.sub(r'\s+', ' ', v) for k, v in e.get('tags', {}).items() if 'rcdb' not in k.lower() and 'rcdb' not in v.lower()}
        name = t.get('name:en') or t.get('name')
        if not name: continue
        def length(v):
            n = num(v)
            if n is None: return None
            return round(n, 1) if re.search(r"ft|'", str(v)) else round(n * 3.28084, 1)
        f = {}
        for k, fld in (('height', 'h'), ('length', 'l')):
            if t.get(k) and length(t[k]) is not None: f[fld] = length(t[k])
        for k in ('maxspeed', 'speed', 'roller_coaster:max_speed'):
            if t.get(k) and num(t[k]) is not None:
                f['s'] = round(num(t[k]), 1) if 'mph' in t[k] else round(num(t[k]) * 0.621371, 1); break
        for k in ('inversions', 'roller_coaster:inversions'):
            if t.get(k) and num(t[k]) is not None: f['inv'] = int(num(t[k])); break
        if t.get('start_date') and date(t['start_date']): f['opened'] = date(t['start_date'])
        if t.get('end_date') and date(t['end_date']): f['closed'] = date(t['end_date'])
        if t.get('manufacturer'): f['manu'] = maker(t['manufacturer'])
        if t.get('model'): f['model'] = t['model']
        mat = (t.get('material') or t.get('roller_coaster:material') or '').lower()
        if 'wood' in mat: f['type'] = 'Wood'
        elif 'steel' in mat or 'metal' in mat: f['type'] = 'Steel'
        names = [name] + [t[k] for k in t if k.startswith(('name', 'old_name', 'alt_name')) and ':' not in k[4:] or k in ('name:en', 'old_name', 'alt_name')]
        items.append(dict(source='osm', ref='%s/%d' % (e['type'], e['id']), name=name, park=None,
                          names={sq(n) for n in names if n}, parks=set(),
                          lat=e.get('lat'), lon=e.get('lon'), raw=t, facts=f))

def wiki_items():
    """English and German Wikipedia infoboxes (2026-11-19): sources 'enwiki'
    and 'dewiki', ref = the article title."""
    def dnum(v):
        # German decimals use a comma ("53,5"); English uses it for thousands.
        v = str(v or '')
        if re.search(r'\d,\d{1,2}(?!\d)', v) and '.' not in v: v = v.replace(',', '.')
        return num(v)
    for lang, src in (('en', 'enwiki'), ('de', 'dewiki')):
        p = 'tools/open-data/wikipedia/%s.jsonl' % lang
        if not os.path.exists(p): continue
        for line in open(p):
            r = json.loads(line)
            b = {k: re.sub(r'\s+', ' ', v) for k, v in r['params'].items() if 'rcdb' not in k and 'rcdb' not in v.lower()}
            title = r['title']
            f = {}
            if lang == 'en':
                name = b.get('name') or re.sub(r'\s*\([^)]*\)$', '', title)
                park = b.get('location')
                def metric(base, factor):
                    for k, conv in ((base + '_ft', 1), (base + '_mph', 1), (base + '_m', factor), (base + '_kmh', 0.621371), (base + '_km/h', 0.621371)):
                        if num(b.get(k)) is not None: return round(num(b[k]) * conv, 1)
                    return None
                for k, fld in (('height', 'h'), ('length', 'l')):
                    v = metric(k, 3.28084)
                    if v is not None: f[fld] = v
                v = metric('speed', 1)
                if v is not None: f['s'] = v
                if num(b.get('inversions')) is not None: f['inv'] = int(num(b['inversions']))
                if b.get('duration') and secs(b['duration']): f['dur'] = secs(b['duration'])
                for k, fld in (('opened', 'opened'), ('closed', 'closed'), ('closing_date', 'closed')):
                    d = date(b.get(k))
                    if d and fld not in f: f[fld] = d
                if b.get('manufacturer'): f['manu'] = maker(b['manufacturer'])
                if b.get('model'): f['model'] = b['model']
                t = (b.get('type') or '').lower()
            else:
                name = b.get('name') or re.sub(r'\s*\([^)]*\)$', '', title)
                park = b.get('freizeitpark') or b.get('park')
                for k, fld, conv in (('höhe', 'h', 3.28084), ('länge', 'l', 3.28084), ('geschwindigkeit', 's', 0.621371)):
                    if dnum(b.get(k)) is not None: f[fld] = round(dnum(b[k]) * conv, 1)
                if dnum(b.get('inversionen')) is not None: f['inv'] = int(dnum(b['inversionen']))
                if b.get('fahrzeit') and secs(b['fahrzeit']): f['dur'] = secs(b['fahrzeit'])
                for k, fld in (('eröffnung', 'opened'), ('schließung', 'closed'), ('schliessung', 'closed')):
                    d = date(b.get(k))
                    if d and fld not in f: f[fld] = d
                if b.get('hersteller'): f['manu'] = maker(b['hersteller'])
                if b.get('modell'): f['model'] = b['modell']
                t = (b.get('typ') or '').lower().replace('stahl', 'steel').replace('holz', 'wood')
            if 'wood' in t and 'steel' not in t: f['type'] = 'Wood'
            elif 'steel' in t or 'hybrid' in t: f['type'] = 'Steel'
            names = [name, title, re.sub(r'\s*\([^)]*\)$', '', title)] + [x.strip() for x in re.split(r'[;,]', b.get('previousnames', '')) if x.strip()]
            names = [re.sub(r'\s*\(\d{4}.*\)$', '', n) for n in names]
            items.append(dict(source=src, ref=title, name=name, park=park,
                              names={sq(n) for n in names if n}, parks={sq(park or '')} - {''},
                              lat=None, lon=None, raw=b, facts=f))

cp_items(); osm_items(); wiki_items()

# ---- matching ------------------------------------------------------------
by = collections.defaultdict(lambda: collections.defaultdict(list))   # source -> squashed name -> items
for it in items:
    for n in it['names']: by[it['source']][n].append(it)

# A chain's parks share a name ("Peppa Pig Theme Park" is Florida and Texas,
# "Happy Valley" seven cities): a record is NOT at our park when its
# coordinates are 30+ km away, or when our park carries its town ("Happy
# Valley (Wuhan)") and the record's location names another (2026-11-19).
def town_in(park):
    m = re.search(r'\(([^)]+)\)\s*$', park or '')
    return sq(m.group(1)) if m else None
def elsewhere(it, park, pk):
    if it['lat'] is not None and pk.get('lat') is not None and km(it['lat'], it['lon'], pk['lat'], pk['lon']) > 30: return True
    raw = it.get('raw') or {}
    t, loc = town_in(park), sq(raw.get('location') or raw.get('ort') or raw.get('standort') or '')
    return bool(t and loc and t not in loc and sq(base(park)) in it['parks'])
found = collections.defaultdict(list)   # (source, ref) -> [(coaster, method)]
for c in coasters:
    names = {sq(c['name']), sq(base(c['name']))} | {sq(n) for n in alias_by_c.get(c['id'], [])}
    pk = parks.get(c['park']) or {}
    pnames = {sq(c['park'])} | {sq(n) for n in palias.get(c['park'], [])}
    for src in by:
        best = None
        for n in names:
            for it in by[src].get(n, []):
                if elsewhere(it, c['park'], pk): continue
                if it['parks'] & pnames or any(p in x or x in p for p in pnames for x in it['parks'] if len(x) > 5 and len(p) > 5):
                    best = (it, 'name+park'); break
                if it['lat'] is not None and pk.get('lat') is not None and km(it['lat'], it['lon'], pk['lat'], pk['lon']) <= 3:
                    best = (it, 'name+coords'); break
            if best: break
        if best: found[(src, best[0]['ref'])].append((c, best[1]))

byid = {c['id']: c for c in coasters}
matches = []
for (src, ref), cs in found.items():
    rows = [c for c, _ in cs]
    pair = len({r['park'] for r in rows}) == 1 and len({sq(base(r['name'])) for r in rows}) == 1 and all(base(r['name']) != r['name'] for r in rows)
    if len(rows) == 1 or pair:
        for c, m in cs: matches.append(dict(source=src, ref=ref, coaster_id=c['id'], method=m, status='linked'))
    else:
        for c, m in cs: matches.append(dict(source=src, ref=ref, coaster_id=c['id'], method=m, status='ambiguous'))
# One of our coasters linked to several records of one source: keep them all
# for review, link none.
per = collections.defaultdict(list)
for m in matches:
    if m['status'] == 'linked': per[(m['source'], m['coaster_id'])].append(m)
for ms in per.values():
    if len(ms) > 1:
        for m in ms: m['status'] = 'ambiguous'

item_by = {(it['source'], it['ref']): it for it in items}

# Decisions made on /open-review win over the matcher, both ways
# (tools/open-data/reviews.json, exported from D1's open_reviews by the job).
reviews = json.load(open('tools/open-data/reviews.json')) if os.path.exists('tools/open-data/reviews.json') else []
for r in reviews:
    if r.get('kind') != 'match' or r.get('source') not in ('coasterpedia', 'osm', 'enwiki', 'dewiki'): continue
    key, cid = (r['source'], r['ref']), int(r['coaster_id'])
    if key not in item_by or cid not in byid: continue
    # This coaster's other links in this source, and this record's other coasters, give way.
    matches = [m for m in matches if not (m['source'] == r['source'] and (m['coaster_id'] == cid or m['ref'] == r['ref']) and r['decision'] == 'approve')
               and not (m['source'] == r['source'] and m['ref'] == r['ref'] and m['coaster_id'] == cid)]
    if r['decision'] == 'approve':
        matches.append(dict(source=r['source'], ref=r['ref'], coaster_id=cid, method='approved', status='linked'))

facts = []
for m in matches:
    if m['status'] != 'linked': continue
    for fld, v in item_by[(m['source'], m['ref'])]['facts'].items():
        val, prec = (v if isinstance(v, tuple) else (v, None))
        facts.append(dict(coaster_id=m['coaster_id'], source=m['source'], ref=m['ref'], field=fld, value=val, prec=prec))

out = dict(retrieved=datetime.date.today().isoformat(),
           items=sorted([dict(source=i['source'], ref=i['ref'], name=i['name'], park=i['park'], lat=i['lat'], lon=i['lon'], raw=i['raw'])
                         for i in items], key=lambda i: (i['source'], i['ref'])),
           matches=sorted(matches, key=lambda m: (m['source'], m['ref'], m['coaster_id'])),
           facts=sorted(facts, key=lambda f: (f['source'], f['coaster_id'], f['field'])),
           # Every record's facts, matched or not, ready for a link approved by hand.
           records={i['source'] + '|' + i['ref']: {k: (list(v) if isinstance(v, tuple) else [v, None]) for k, v in i['facts'].items()}
                    for i in items})
json.dump(out, open('tools/open-data/sources-matches.json', 'w'), ensure_ascii=False, sort_keys=True, indent=0)
for src in sorted({i['source'] for i in items}):
    st = collections.Counter(m['status'] for m in matches if m['source'] == src)
    linked = {m['coaster_id'] for m in matches if m['source'] == src and m['status'] == 'linked'}
    fc = collections.Counter(f['field'] for f in facts if f['source'] == src)
    print(src, 'records', sum(1 for i in items if i['source'] == src), 'coasters linked', len(linked), dict(st), dict(sorted(fc.items())))
