#!/usr/bin/env python3
"""Match the Wikidata pull (tools/open-data/wikidata/*.csv) to our coasters and
write tools/open-data/wikidata-matches.json: per coaster, the Wikidata item it
is and every fact Wikidata gives for it, converted to our units, each marked
with whether Wikidata's own reference for it cites RCDB.

Matching is deliberately strict (a wrong link is worse than none):
  the names agree (our name, its base before " (Left)", or a former name,
  against the Wikidata label or an alias, compared squashed), AND
  the park agrees (a "part of" / "location" label matches our park or one of
  its former names) or the Wikidata coordinate is within 3 km of our park.
A racing pair (X (Left) / X (Right)) is usually one Wikidata item: both rows
get it. Run from the repo root after wikidata-pull.sh."""
import csv, json, math, re, unicodedata, collections, datetime

def sq(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'^the\s+', '', s)
    s = s.replace('&', 'and')
    return re.sub(r'[^a-z0-9]', '', s)

def base(n):
    # A racing side ("Gemini (Red)") shares its pair's Wikidata item; an
    # "(Old)" or a year ("Big Dipper (1935)") is a different ride, so its
    # suffix stays.
    m = re.match(r'^(.*?)\s*\(([^)]*)\)\s*$', n or '')
    if not m or re.match(r'^(old|new|\d{4})$', m.group(2).strip(), re.I): return n or ''
    return m.group(1)

W = 'tools/open-data/wikidata/'
items = {}
for r in csv.DictReader(open(W + 'base.csv')):
    qid = r['c'].rsplit('/', 1)[1]
    names = [r['label']] + [a for a in r['aliases'].split('|') if a]
    m = re.match(r'Point\(([-\d.]+) ([-\d.]+)\)', r['coord'] or '')
    items[qid] = dict(qid=qid, label=r['label'], names={sq(n) for n in names if n},
                      parks={sq(x) for x in (r['partOf'] + '|' + r['location']).split('|') if x},
                      lat=float(m.group(2)) if m else None, lon=float(m.group(1)) if m else None,
                      makers=[x for x in r['makers'].split('|') if x], material=r['material'],
                      types=r['types'], osm=r['osmWay'] or r['osmNode'], cc=r['captainCoaster'])

facts = collections.defaultdict(dict)   # qid -> field -> (value, prec, cites_rcdb)
def keep(qid, field, val, prec, rc):
    old = facts[qid].get(field)
    # Prefer a value that does NOT cite RCDB; then the first seen.
    if old is None or (old[2] and not rc):
        facts[qid][field] = (val, prec, rc)
for r in csv.DictReader(open(W + 'stats.csv')):
    qid = r['c'].rsplit('/', 1)[1]; v = float(r['value']); rc = r['rcdbRef'] == 'true'
    f = r['field']
    if f == 'height_m': keep(qid, 'h', round(v * 3.28084, 1), None, rc)
    elif f == 'length_m': keep(qid, 'l', round(v * 3.28084, 1), None, rc)
    elif f == 'speed_ms': keep(qid, 's', round(v * 2.23694, 1), None, rc)
    elif f == 'duration_s': keep(qid, 'dur', int(round(v)), None, rc)
PREC = {'11': 'day', '10': 'month', '9': 'year'}
for r in csv.DictReader(open(W + 'dates.csv')):
    qid = r['c'].rsplit('/', 1)[1]; rc = r['rcdbRef'] == 'true'
    p = PREC.get(r['prec']); d = r['value'][:10]
    if not p or not re.match(r'^\d{4}-\d\d-\d\d$', d): continue
    d = d[:4] if p == 'year' else d[:7] if p == 'month' else d
    keep(qid, r['field'], d, p, rc)

data = json.load(open('coasters.json')); coasters = data['coasters']
parks = json.load(open('parks.json'))
alias_by_c = collections.defaultdict(list)
for a in data.get('aliases', []): alias_by_c[a['c']].append(a['n'])
palias = collections.defaultdict(list)
for a in data.get('parkAliases', []): palias[a['p']].append(a['n'])

def km(a, b, c, d):
    r = math.pi / 180
    return 6371 * math.acos(min(1, math.sin(a*r)*math.sin(c*r) + math.cos(a*r)*math.cos(c*r)*math.cos((b-d)*r)))

by_name = collections.defaultdict(list)
for q in items.values():
    for n in q['names']: by_name[n].append(q)

# Our maker spellings, to map Wikidata's legal names onto (Vekoma Rides
# Manufacturing B.V. -> Vekoma): the longest of ours contained in theirs.
# Several spellings that squash the same ("MACK RIdes" / "MACK Rides"): the
# one most rows use. Wikidata also lists designers and park owners as makers.
# They are kept (Carter, 2026-11-18: "Keep park owners for now ... filter
# through instead of drop data"), but a real maker wins when there is one.
freq = collections.Counter(c['manu'] for c in coasters if c.get('manu'))
ours = sorted(freq, key=lambda m: (-len(sq(m)), -freq[m]))
NOT_MAKERS = {'wernerstengel', 'sixflags', 'taftbroadcasting', 'ingburostengelgmbh', 'herschendfamilyentertainment', 'henselphelps', 'cedarfair', 'disney', 'thewaltdisneycompany', 'waltdisneyimagineering'}
def owner(wd): return any(k in sq(wd) for k in NOT_MAKERS)
def maker(wd):
    s = sq(wd)
    for m in ours:
        if sq(m) and sq(m) in s: return m
    return wd

# Every item's facts in our units, matched or not: the review dashboard
# links an item by hand, and its stats must be ready to copy when it does.
def record_facts(q):
    f = {k: {'v': v[0], 'prec': v[1], 'cites_rcdb': v[2]} for k, v in facts.get(q['qid'], {}).items()}
    mk = next((maker(w) for w in q['makers'] if not owner(w)), None) or next((maker(w) for w in q['makers']), None)
    if mk: f['manu'] = {'v': mk, 'prec': None, 'cites_rcdb': False}
    mat = (q['material'] + ' ' + q['types']).lower()
    t = 'Wood' if 'wood' in mat else 'Steel' if 'steel' in mat else None
    if t: f['type'] = {'v': t, 'prec': None, 'cites_rcdb': False}
    return f
def link(q, m):
    return {'qid': q['qid'], 'label': q['label'], 'method': m, 'osm': q['osm'] or None,
            'captainCoaster': q['cc'] or None, 'facts': record_facts(q)}

out, how = {}, collections.Counter()
for c in coasters:
    names = {sq(c['name']), sq(base(c['name']))} | {sq(n) for n in alias_by_c.get(c['id'], [])}
    pk = parks.get(c['park']) or {}
    pnames = {sq(c['park'])} | {sq(n) for n in palias.get(c['park'], [])}
    best = None
    for n in names:
        for q in by_name.get(n, []):
            if q['parks'] & pnames or any(p in x or x in p for p in pnames for x in q['parks'] if len(x) > 5 and len(p) > 5):
                best = (q, 'name+park'); break
            if q['lat'] is not None and pk.get('lat') is not None and km(q['lat'], q['lon'], pk['lat'], pk['lon']) <= 3:
                best = (q, 'name+coords'); break
        if best: break
    if not best: continue
    q, m = best; how[m] += 1
    out[c['id']] = link(q, m)

# One Wikidata item on several of our rows is right for a racing pair (same
# park, same base name) and wrong otherwise ("GhostRider (Old)" and
# "GhostRider", a Backlot Stunt Coaster at two parks). Keep a non-pair group
# only where exactly one row carries the item's own name at a nearby park.
groups = collections.defaultdict(list)
for k, v in out.items(): groups[v['qid']].append(k)
byid = {c['id']: c for c in coasters}
dropped = 0
ambiguous = []   # kept for review, not linked: [{qid, coaster_id, method}]
for qid, ks in groups.items():
    if len(ks) < 2: continue
    rows = [byid[k] for k in ks]
    if len({r['park'] for r in rows}) == 1 and len({sq(base(r['name'])) for r in rows}) == 1 and all(base(r['name']) != r['name'] for r in rows):
        continue
    q = items[qid]
    keep_ = [r for r in rows if sq(r['name']) in q['names'] and (q['lat'] is None or (parks.get(r['park']) or {}).get('lat') is None
             or km(q['lat'], q['lon'], parks[r['park']]['lat'], parks[r['park']]['lon']) <= 3)]
    for r in rows:
        if len(keep_) != 1 or r is not keep_[0]:
            ambiguous.append({'qid': qid, 'coaster_id': r['id'], 'method': out[r['id']]['method']})
            del out[r['id']]; dropped += 1
print('ambiguous (kept for review, not linked)', dropped)

# Decisions made on /open-review win over the matcher, both ways
# (tools/open-data/reviews.json, exported from D1's open_reviews by the job).
import os
reviews = json.load(open('tools/open-data/reviews.json')) if os.path.exists('tools/open-data/reviews.json') else []
for r in reviews:
    if r.get('kind') != 'match' or r.get('source') != 'wikidata': continue
    cid, qid = int(r['coaster_id']), r['ref']
    if r['decision'] == 'approve' and qid in items and cid in byid:
        out[cid] = link(items[qid], 'approved')
        ambiguous = [a for a in ambiguous if a['coaster_id'] != cid]
    elif r['decision'] == 'reject' and cid in out and out[cid]['qid'] == qid:
        del out[cid]

records = {qid: record_facts(q) for qid, q in items.items()}
json.dump({'retrieved': datetime.date.today().isoformat(), 'matches': out, 'ambiguous': ambiguous, 'records': records},
          open('tools/open-data/wikidata-matches.json', 'w'), indent=0, sort_keys=True)
fields = collections.Counter(k for v in out.values() for k in v['facts'])
clean = collections.Counter(k for v in out.values() for k, x in v['facts'].items() if not x['cites_rcdb'])
print('coasters', len(coasters), 'matched', len(out), dict(how))
print('fields (any / not citing RCDB):', {k: (fields[k], clean[k]) for k in sorted(fields)})
