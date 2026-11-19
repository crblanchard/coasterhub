#!/usr/bin/env python3
"""The checks behind /open-review (2026-11-18). Reads the matcher outputs
(wikidata-matches.json, sources-matches.json) and writes
tools/open-data/review.json:

  suggestions  [{source, ref, coaster_id, score, reason}]  links the strict
               matchers did not make, for Carter to approve or reject:
     - near names: the names are close but not equal ("Wild Cat" / "Wildcat",
       "Batman The Ride" / "Batman: The Ride"), at the same park or within
       5 km of it
     - former names at the park: a record carrying one of our former names
     - same Wikidata item: an OSM coaster tagged wikidata=Q... where that item
       is already linked to one of ours
     - ambiguous: the strict matcher found several candidates and linked none
  adds         [{source, ref, park, status}]  open-source coasters at a park
               we have (by name or within 2 km) that match none of ours: new
               rows for the open dataset, if approved
  records      every Wikidata item's name/park/coords, so the dashboard can
               show it (Coasterpedia and OSM have theirs in open_items)

Decisions already made (reviews.json) are not suggested again.
Run from the repo root after the matchers."""
import collections, csv, datetime, difflib, json, math, os, re, unicodedata

def sq(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'^the\s+', '', s).replace('&', 'and')
    return re.sub(r'[^a-z0-9]', '', s)
def km(a, b, c, d):
    r = math.pi / 180
    return 6371 * math.acos(max(-1, min(1, math.sin(a*r)*math.sin(c*r) + math.cos(a*r)*math.cos(c*r)*math.cos((b-d)*r))))

data = json.load(open('coasters.json')); coasters = data['coasters']; byid = {c['id']: c for c in coasters}
parks = json.load(open('parks.json'))
alias_by_c = collections.defaultdict(list)
for a in data.get('aliases', []): alias_by_c[a['c']].append(a['n'])
palias = collections.defaultdict(list)
for a in data.get('parkAliases', []): palias[a['p']].append(a['n'])
wd = json.load(open('tools/open-data/wikidata-matches.json'))
src = json.load(open('tools/open-data/sources-matches.json'))
reviews = json.load(open('tools/open-data/reviews.json')) if os.path.exists('tools/open-data/reviews.json') else []
decided = {(r['source'], r['ref'], int(r['coaster_id'])) for r in reviews if r.get('kind') == 'match'}
added = {(r['source'], r['ref']) for r in reviews if r.get('kind') == 'add'}

# ---- every record, one shape ------------------------------------------------
recs = []    # {source, ref, name, names, park, parks, lat, lon, wikidata, status}
for r in csv.DictReader(open('tools/open-data/wikidata/base.csv')):
    qid = r['c'].rsplit('/', 1)[1]
    m = re.match(r'Point\(([-\d.]+) ([-\d.]+)\)', r['coord'] or '')
    names = [r['label']] + [a for a in r['aliases'].split('|') if a]
    pk = [x for x in (r['partOf'] + '|' + r['location']).split('|') if x]
    recs.append(dict(source='wikidata', ref=qid, name=r['label'] or qid, names=[n for n in names if n], park=' | '.join(pk) or None,
                     parks={sq(x) for x in pk}, lat=float(m.group(2)) if m else None, lon=float(m.group(1)) if m else None,
                     wikidata=qid, status=None, country=r['country']))
for i in src['items']:
    raw = i['raw']
    names = [i['name']] + [v for k, v in raw.items() if re.fullmatch(r'name\d|old_name|alt_name|name:en', k)]
    recs.append(dict(source=i['source'], ref=i['ref'], name=i['name'], names=[n for n in names if n], park=i['park'],
                     parks={sq(i['park'])} - {''} if i['park'] else set(), lat=i['lat'], lon=i['lon'],
                     wikidata=raw.get('wikidata'), status=raw.get('status'), country=raw.get('country'), location=raw.get('location')))

# ---- what is linked already -------------------------------------------------
linked = collections.defaultdict(dict)        # source -> ref -> coaster ids
has = collections.defaultdict(set)            # coaster id -> sources linked
for cid, v in wd['matches'].items():
    linked['wikidata'].setdefault(v['qid'], set()).add(int(cid)); has[int(cid)].add('wikidata')
for m in src['matches']:
    if m['status'] == 'linked':
        linked[m['source']].setdefault(m['ref'], set()).add(m['coaster_id']); has[m['coaster_id']].add(m['source'])

sugg = {}
def suggest(s, ref, cid, score, reason):
    if (s, ref, cid) in decided or s in has[cid]: return
    k = (s, ref, cid)
    if k not in sugg or sugg[k]['score'] < score:
        sugg[k] = dict(source=s, ref=ref, coaster_id=cid, score=round(score, 2), reason=reason)

# The strict matcher's ambiguous candidates.
for a in wd['ambiguous']: suggest('wikidata', a['qid'], a['coaster_id'], 0.9, 'one of several candidates')
for m in src['matches']:
    if m['status'] == 'ambiguous': suggest(m['source'], m['ref'], m['coaster_id'], 0.9, 'one of several candidates')

# Same Wikidata item: OSM tags often name the Wikidata item.
wd_to_c = {v['qid']: int(cid) for cid, v in wd['matches'].items()}
for r in recs:
    if r['source'] == 'osm' and r['wikidata'] in wd_to_c and r['ref'] not in linked['osm']:
        suggest('osm', r['ref'], wd_to_c[r['wikidata']], 1.0, 'tagged with the same Wikidata item')

# Near names and former names, at the park or within 5 km of it.
def park_names(p): return {sq(p)} | {sq(n) for n in palias.get(p, [])}
# Countries, spelled one way: our regions are "State, US" or a country name.
CC = {'usa': 'us', 'unitedstates': 'us', 'unitedstatesofamerica': 'us', 'uk': 'unitedkingdom', 'england': 'unitedkingdom',
      'scotland': 'unitedkingdom', 'wales': 'unitedkingdom', 'northernireland': 'unitedkingdom', 'uae': 'unitedarabemirates',
      'peoplesrepublicofchina': 'china', 'southkorea': 'southkorea', 'korea': 'southkorea', 'czechia': 'czechrepublic', 'holland': 'netherlands'}
def country(v):
    if not v: return None
    v = sq(v.split(',')[-1]); return CC.get(v, v)
# A chain's parks carry their town ("Happy Valley (Wuhan)"): a record whose
# location names another town is at another of them (2026-11-19).
def other_town(r, p):
    # Coordinates on both sides decide on their own ("Adventureland (Iowa)"
    # names a state, and its rides say "Altoona").
    if r.get('lat') is not None and (parks.get(p) or {}).get('lat') is not None: return False
    m = re.search(r'\(([^)]+)\)\s*$', p)
    loc = sq(r.get('location') or '')
    return bool(m and loc and sq(m.group(1)) not in loc and sq(re.sub(r'\s*\([^)]*\)\s*$', '', p)) in r['parks'])
def chain_park(r, p):
    m = re.search(r'\(([^)]+)\)\s*$', p)
    return bool(m and sq(m.group(1)) in sq(r.get('location') or '') and sq(re.sub(r'\s*\([^)]*\)\s*$', '', p)) in r['parks'])
def other_country(r, p):
    if other_town(r, p): return True
    a, b = country(r.get('country')), country((parks.get(p) or {}).get('region'))
    return bool(a and b and a != b)
def at_park(r, p):
    pn, pk = park_names(p), parks.get(p) or {}
    # Same park name 30+ km away is another park ("Adventureland" is several).
    if r['lat'] is not None and pk.get('lat') is not None and km(r['lat'], r['lon'], pk['lat'], pk['lon']) > 30: return None
    if other_country(r, p): return None
    if r['parks'] & pn or any(a in b or b in a for a in pn for b in r['parks'] if len(a) > 5 and len(b) > 5): return 'park'
    if r['lat'] is not None and pk.get('lat') is not None and km(r['lat'], r['lon'], pk['lat'], pk['lon']) <= 5: return 'nearby'
    return None
by_park = collections.defaultdict(list)
for p in parks:
    for r in recs:
        if r['ref'] in linked[r['source']]: continue
        w = at_park(r, p)
        if w: by_park[p].append((r, w))
for c in coasters:
    ours = {sq(c['name'])} | {sq(re.sub(r'\s*\([^)]*\)$', '', c['name']))}
    former = {sq(n) for n in alias_by_c.get(c['id'], [])}
    for r, where in by_park.get(c['park'], []):
        theirs = {sq(n) for n in r['names']} - {''}
        if theirs & former:
            suggest(r['source'], r['ref'], c['id'], 0.95, 'carries a former name, ' + ('at the park' if where == 'park' else 'nearby')); continue
        best = max((difflib.SequenceMatcher(None, a, b).ratio() for a in ours for b in theirs if a and b), default=0)
        contains = any(len(a) >= 5 and len(b) >= 5 and (a in b or b in a) for a in ours for b in theirs)
        if best >= 0.8 or contains:
            score = max(best, 0.8 if contains else 0) + (0.05 if where == 'park' else 0)
            suggest(r['source'], r['ref'], c['id'], min(score, 0.99), 'similar name, ' + ('at the park' if where == 'park' else 'within 5 km'))

# Open-source coasters at our parks that match none of ours: candidates to add.
suggested_refs = {(s['source'], s['ref']) for s in sugg.values()}
# Names already at each park (ours, and our former names): OSM often maps one
# ride as several features ("Cobra" and "Cobra Station"), so a record whose
# name is, or contains, one of these is that ride, not a new one.
here = collections.defaultdict(set)
for c in coasters:
    for n in [c['name'], re.sub(r'\s*\([^)]*\)$', '', c['name'])] + alias_by_c.get(c['id'], []):
        if sq(n): here[c['park']].add(sq(n))
cands = []   # (park, record, distance)
for r in recs:
    k = (r['source'], r['ref'])
    if r['ref'] in linked[r['source']] or k in suggested_refs or k in added: continue
    best = None
    for p, pk in parks.items():
        # Stricter than for suggestions: the park's own name exactly, or
        # within 2 km ("Luna Park" must not take Luna Park Cap d'Agde's rides).
        far = r['lat'] is not None and pk.get('lat') is not None and km(r['lat'], r['lon'], pk['lat'], pk['lon']) > 30
        if (r['parks'] & park_names(p) or chain_park(r, p)) and not far and not other_country(r, p): d = 0
        elif r['lat'] is not None and pk.get('lat') is not None:
            d = km(r['lat'], r['lon'], pk['lat'], pk['lon'])
            if d > 2: continue
        else: continue
        if best is None or d < best[1]: best = (p, d)
    if not best: continue
    n = sq(r['name'])
    if not n or re.search(r'station|queue|entrance|track|lift', r['name'] or '', re.I): continue
    if any(len(h) >= 4 and (h == n or h in n or n in h) for h in here[best[0]]): continue
    cands.append((best[0], r))
# One ride, several sources: group by park and squashed name, one entry each,
# listing every source that has it.
# Two records from ONE source with one name at one park are two rides
# (Butterfly at Schloss Thurn, 1993 and 2022), never one: the second gets its
# own entry. Merged, the add read the wrong page's stats (fixed in 199).
groups = collections.OrderedDict()
for p, r in sorted(cands, key=lambda x: (x[0], sq(x[1]['name']), x[1]['source'])):
    n = 0
    while any(x['source'] == r['source'] for x in groups.get((p, sq(r['name']), n), [])): n += 1
    groups.setdefault((p, sq(r['name']), n), []).append(r)
uniq = [dict(park=p, name=rs[0]['name'], status=next((r['status'] for r in rs if r['status']), None),
             refs=[dict(source=r['source'], ref=r['ref']) for r in rs]) for (p, _, _), rs in groups.items()]

# New parks (2026-11-19): open-source coasters at parks that are not on the
# site at all, grouped by park, with the park's coordinates (average of its
# coasters') and region. Carter checks each before anything goes up. Only
# parks with at least one coaster operating or being built; Wikidata alone
# names no park, so it only joins a park another source names.
REGION = {'usa': 'US', 'unitedstates': 'US', 'unitedstatesofamerica': 'US', 'uk': 'United Kingdom', 'england': 'United Kingdom',
          'scotland': 'United Kingdom', 'wales': 'United Kingdom', 'uae': 'United Arab Emirates', 'peoplesrepublicofchina': 'China'}
def region_of(raw):
    c = (raw.get('country') or raw.get('land') or '').strip()
    st = (raw.get('state') or raw.get('bundesland') or '').strip()
    k = REGION.get(sq(c), c)
    if k == 'US': return (st + ', US') if st else None
    return k or None
known_parks = set()
for p in parks: known_parks |= park_names(p)
# A park name we have is only OUR park when nothing says it is somewhere
# else: "Central Park", "Familypark" and "Luna Park" are each several parks,
# and the loose match used to drop 160-odd live coasters at parks that are
# not on the site at all (2026-11-19).
park_by_name = collections.defaultdict(list)
for p in parks:
    for n in park_names(p): park_by_name[n].append(p)
def is_known(r, pk):
    cand = list(park_by_name.get(pk, []))
    if len(pk) > 6: cand += [p for k, ps in park_by_name.items() if len(k) > 6 and k != pk and (pk in k or k in pk) for p in ps]
    for p in cand:
        pp = parks.get(p) or {}
        if other_country(r, p): continue
        if r['lat'] is not None and pp.get('lat') is not None and km(r['lat'], r['lon'], pp['lat'], pp['lon']) > 30: continue
        return True
    return False
# Pins looked up for parks no source gives coordinates for
# (tools/open-data/park-pins.py: Wikidata, then OpenStreetMap, then the town
# as an estimate), keyed by park name and Coasterpedia location.
PINS = json.load(open('tools/open-data/park-pins.json')) if os.path.exists('tools/open-data/park-pins.json') else {}
claimed = {(r['source'], r['ref']) for g in uniq for r in g['refs']} | suggested_refs
def same_town(a, b):
    return a == b or (min(len(a), len(b)) >= 4 and (a in b or b in a)) or difflib.SequenceMatcher(None, a, b).ratio() >= 0.85
newp = collections.OrderedDict()
for r in recs:
    if r['source'] == 'wikidata' or not r.get('park') or r['ref'] in linked[r['source']] or (r['source'], r['ref']) in claimed: continue
    pk = sq(r['park'])
    # Not parks: Coasterpedia's "Standalone" (a coaster at no park) and
    # "Traveling"; and fairs wait for their own pass (Carter: parks first).
    if re.fullmatch(r'standalone|travel+ing|none|unknown', pk) or re.search(r'state ?fair|county ?fair|kermis|kirmes|volksfest|schützenfest', r['park'] or '', re.I): continue
    if not pk or is_known(r, pk): continue
    if r['lat'] is not None and any(pp.get('lat') is not None and km(r['lat'], r['lon'], pp['lat'], pp['lon']) <= 3 for pp in parks.values()): continue
    raw = next((i['raw'] for i in src['items'] if i['source'] == r['source'] and i['ref'] == r['ref']), {})
    # Same name, different park ("Greenland", "VinWonders" are several): split
    # by country, and by distance when both sides have coordinates.
    # Coasterpedia's location ("Tong'an, Xiamen, Fujian") splits them too, for
    # pages with no coordinates: Oriental Heritage is five parks, and before
    # this the ones without a pin all joined the first (fixed in 198).
    # Two locations are one place when they share a town ("Gijang, Busan" and
    # "Busan"); a 3-part location's last part is the province, which does not
    # count ("..., Fujian" twice can be two cities).
    key = (pk,)
    # A "location" that is just the park's name says nothing. Coordinates on
    # both sides decide on their own (30 km); otherwise the towns do, spelled
    # loosely ("Gijang"/"Gijang-gun", "Cincinnati"/"Cincinatti").
    parts = [sq(x) for x in (raw.get('location') or '').split(',') if sq(x)]
    loc = frozenset(parts[:-1] if len(parts) >= 3 else parts) or None
    if loc and (pk in loc or loc == {pk}): loc = None
    n = 0
    while key + (n,) in newp:
        gg = newp[key + (n,)]
        if r['lat'] is not None and gg['lats']:
            if km(r['lat'], r['lon'], gg['lats'][0], gg['lons'][0]) <= 30: break
        elif loc is None or not gg['locs'] or any(same_town(a, b) for l in gg['locs'] for a in loc for b in l): break
        n += 1
    g = newp.setdefault(key + (n,), dict(park=r['park'], coasters=collections.OrderedDict(), lats=[], lons=[], regions=collections.Counter(), locs=set(), location=None, country=None))
    if loc: g['locs'].add(loc)
    if raw.get('location') and not g['location']: g['location'] = raw['location']
    if (raw.get('country') or r.get('country')) and not g['country']: g['country'] = raw.get('country') or r.get('country')
    if r['lat'] is not None: g['lats'].append(r['lat']); g['lons'].append(r['lon'])
    rg = region_of(raw)
    if rg: g['regions'][rg] += 1
    k = sq(r['name'])
    while k in g['coasters'] and any(x['source'] == r['source'] for x in g['coasters'][k]['refs']): k += '#'
    # A ride that never opened is left out (Carter's rule).
    if re.search(r'cancel', r.get('status') or raw.get('status') or '', re.I): continue
    c = g['coasters'].setdefault(k, dict(name=r['name'], status=r.get('status') or raw.get('status'), refs=[]))
    c['refs'].append(dict(source=r['source'], ref=r['ref']))
    if not c['status'] and raw.get('status'): c['status'] = raw['status']
new_parks = []
# "Standing but not operating" is closed here: the site records a ride as
# operating or closed, nothing in between (Carter's rule).
_alive = re.compile(r'operat|construct|open|betrieb', re.I)
class _Alive:
    def search(self, v): return None if re.search(r'not operat|nicht in betrieb|sbno', v or '', re.I) else _alive.search(v or '')
alive = _Alive()
# Parks whose coasters are all closed are listed too, flagged closed_only
# (Carter, 2026-11-19: "eventually want to do closed ... everything on
# coasterpedia").
for g in newp.values():
    cs = list(g['coasters'].values())
    # Coasterpedia's location "Travelling": a showman, not a park (fairs pass).
    if not cs or re.fullmatch(r'\s*travel+ing\s*', g['location'] or '', re.I): continue
    lat = round(sum(g['lats']) / len(g['lats']), 5) if g['lats'] else None
    lon = round(sum(g['lons']) / len(g['lons']), 5) if g['lons'] else None
    pin, region = None, g['regions'].most_common(1)[0][0] if g['regions'] else None
    if lat is None:
        hit = PINS.get(g['park'] + '|' + (g['location'] or ''))
        if hit and hit.get('lat') is not None:
            lat, lon, pin = hit['lat'], hit['lon'], hit['how']
            # A US park needs its state; the geocoder knows it.
            if hit.get('country') == 'United States' and hit.get('state') and (region is None or region == 'US'): region = hit['state'] + ', US'
            elif region is None and hit.get('country') and hit['country'] != 'United States': region = REGION.get(sq(hit['country']), hit['country'])
    new_parks.append(dict(park=g['park'], lat=lat, lon=lon, pin=pin, location=g['location'], country=g['country'],
                          closed_only=not any(alive.search(c['status'] or '') for c in cs),
                          region=region,
                          coasters=sorted(cs, key=lambda c: (not alive.search(c['status'] or ''), c['name']))))
# A name already on the site, or shared by two new parks, gets its town
# ("Oriental Heritage (Xiamen)", Carter 2026-11-20), as its name; the
# review page and tools/add-new-parks.mjs use it (source_park keeps the
# source's own name, which park-pins.json is keyed on).
def town_of(loc, country=None):
    # "District, City, Province" -> City; in China, Korea and Japan a 2-part
    # location is "District, City" too ("Songjiang, Shanghai" -> Shanghai).
    ps = [x.strip() for x in (loc or '').split(',') if x.strip()]
    if len(ps) >= 3: return ps[1]
    if len(ps) == 2 and sq(country or '') in ('china', 'peoplesrepublicofchina', 'southkorea', 'korea', 'japan', 'taiwan'): return ps[1]
    return ps[0] if ps else None
taken = {p.lower() for p in parks}
cnt = collections.Counter(p['park'].lower() for p in new_parks)
for p in new_parks:
    if p['park'].lower() in taken or cnt[p['park'].lower()] > 1:
        t = town_of(p['location'], p.get('country'))
        if t and sq(t) not in sq(p['park']): p['source_park'], p['park'] = p['park'], p['park'] + ' (' + t + ')'
new_parks.sort(key=lambda p: (-sum(1 for c in p['coasters'] if alive.search(c['status'] or '')), p['park']))
print('new parks', len(new_parks), 'with', sum(len(p['coasters']) for p in new_parks), 'coasters')

out = dict(suggestions=sorted(sugg.values(), key=lambda s: (-s['score'], s['coaster_id'], s['source'], s['ref'])),
           adds=uniq, new_parks=new_parks,
           records=[dict(ref=r['ref'], name=r['name'], park=r['park'], lat=r['lat'], lon=r['lon']) for r in recs if r['source'] == 'wikidata'])
json.dump(out, open('tools/open-data/review.json', 'w'), ensure_ascii=False, sort_keys=True, indent=0)
print('suggestions', len(out['suggestions']), collections.Counter(s['reason'].split(',')[0] for s in out['suggestions']))
print('adds', len(uniq), collections.Counter(len(a['refs']) for a in uniq))
