#!/usr/bin/env python3
"""Pins for new parks that no source gives coordinates for (Carter,
2026-11-19: "link up 2 and 3"). Reads tools/open-data/review.json (from
suggest-matches.py) and adds to tools/open-data/park-pins.json, keyed
"park|location" (Coasterpedia's location, e.g. "Tong'an, Xiamen, Fujian"):

  {lat, lon, how, state, country}

how, best first:
  wikidata Q123   the park's own Wikidata item (P625), within 50 km of its town
  osm             OpenStreetMap's park of that name, within 50 km of its town
  town            the town itself: an ESTIMATE, listed for Carter to fix
  none            nothing found (looked up again after 60 days)

The town comes from Nominatim (OpenStreetMap's geocoder) and anchors the
other two, so "Luna Park" never lands on another Luna Park. Never RCDB.
Nominatim asks for one request a second and an identifying User-Agent; the
same one Wikipedia gets (no email, Carter's call). Runs on the GitHub runner
(open-data.yml): Wikimedia throttles the sandbox. Stops after --minutes
(default 40) and saves as it goes, so the next run carries on.
Run from the repo root after suggest-matches.py."""
import datetime, json, math, os, re, sys, time, unicodedata, urllib.parse, urllib.request

UA = 'CoasterHubBot/1.0 (https://coasterhub.org)'
PATH = 'tools/open-data/park-pins.json'
PARKISH = {'theme_park', 'amusement_park', 'water_park', 'zoo', 'park', 'attraction', 'resort', 'leisure_park', 'pleasure_garden'}
# Wikidata: amusement park, theme park, water park, zoo, family park, park,
# safari park, resort, funfair, recreation area
PARK_Q = {'Q194195', 'Q2416723', 'Q740326', 'Q43501', 'Q24705012', 'Q22698', 'Q1324860', 'Q875157', 'Q868557', 'Q2063507'}

minutes = 40
if '--minutes' in sys.argv: minutes = float(sys.argv[sys.argv.index('--minutes') + 1])
deadline = time.time() + minutes * 60

def sq(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]', '', s)
def km(a, b, c, d):
    r = math.pi / 180
    return 6371 * math.acos(max(-1, min(1, math.sin(a*r)*math.sin(c*r) + math.cos(a*r)*math.cos(c*r)*math.cos((b-d)*r))))

last = {'osm': 0.0, 'wd': 0.0}
def get(url, kind):
    wait = (1.1 if kind == 'osm' else 0.5) - (time.time() - last[kind])
    if wait > 0: time.sleep(wait)
    last[kind] = time.time()
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'}), timeout=30) as r:
                return json.load(r)
        except Exception as e:
            if attempt == 2: print('  failed:', kind, str(e)[:80]); return None
            time.sleep(5 * (attempt + 1))

def nominatim(q):
    j = get('https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(
        {'q': q, 'format': 'jsonv2', 'addressdetails': 1, 'limit': 5, 'accept-language': 'en'}), 'osm')
    return j or []

def wikidata(name):
    j = get('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode(
        {'action': 'wbsearchentities', 'search': name, 'language': 'en', 'limit': 7, 'format': 'json'}), 'wd')
    ids = [x['id'] for x in (j or {}).get('search', [])]
    if not ids: return []
    j = get('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode(
        {'action': 'wbgetentities', 'ids': '|'.join(ids), 'props': 'claims|labels', 'languages': 'en', 'format': 'json'}), 'wd')
    out = []
    for q in ids:
        e = ((j or {}).get('entities') or {}).get(q) or {}
        cl = e.get('claims') or {}
        try: c = cl['P625'][0]['mainsnak']['datavalue']['value']
        except (KeyError, IndexError, TypeError): continue
        types = {x.get('mainsnak', {}).get('datavalue', {}).get('value', {}).get('id') for x in cl.get('P31', [])}
        out.append(dict(q=q, lat=c['latitude'], lon=c['longitude'], park=bool(types & PARK_Q),
                        label=((e.get('labels') or {}).get('en') or {}).get('value', '')))
    return out

def region_bits(addr):
    return (addr or {}).get('state'), (addr or {}).get('country')

pins = json.load(open(PATH)) if os.path.exists(PATH) else {}
today = datetime.date.today()
rv = json.load(open('tools/open-data/review.json'))
todo = [p for p in rv.get('new_parks', []) if p.get('lat') is None]
looked = found = 0
for p in todo:
    name = p.get('source_park') or p['park']
    key = name + '|' + (p.get('location') or '')
    old = pins.get(key)
    if old and (old['how'] != 'none' or (today - datetime.date.fromisoformat(old.get('at', '2000-01-01'))).days < 60): continue
    if time.time() > deadline: print('time is up; the rest next run'); break
    loc = p.get('location') or ''
    if re.fullmatch(r'\s*travel+ing\s*', loc, re.I): continue
    country = p.get('country') or (p.get('region') or '').split(', ')[-1]
    country = 'United States' if country in ('US', 'USA') else country
    looked += 1
    # 1. The town, as the anchor (and the fallback).
    town = None
    for q in [', '.join(x for x in [loc, country] if x), ', '.join(x for x in [loc.split(',')[-2] if loc.count(',') else '', country] if x)]:
        if not q.strip(', '): continue
        hits = nominatim(q)
        if hits: town = hits[0]; break
    tlat, tlon = (float(town['lat']), float(town['lon'])) if town else (None, None)
    near = lambda a, b: tlat is None or km(a, b, tlat, tlon) <= 50
    hit = None
    # 2. The park's own Wikidata item.
    for w in wikidata(name):
        if sq(w['label']) and (sq(name) in sq(w['label']) or sq(w['label']) in sq(name)) and near(w['lat'], w['lon']) and (w['park'] or tlat is not None):
            hit = dict(lat=round(w['lat'], 5), lon=round(w['lon'], 5), how='wikidata ' + w['q']); break
    # 3. OpenStreetMap's park of that name.
    if not hit:
        for o in nominatim(', '.join(x for x in [name, loc.split(',')[-2].strip() if loc.count(',') else loc, country] if x)):
            if (o.get('type') in PARKISH or o.get('category') in ('leisure', 'tourism')) and near(float(o['lat']), float(o['lon'])):
                hit = dict(lat=round(float(o['lat']), 5), lon=round(float(o['lon']), 5), how='osm'); break
    # 4. The town, as an estimate.
    if not hit and town: hit = dict(lat=round(tlat, 5), lon=round(tlon, 5), how='town')
    if not hit: hit = dict(lat=None, lon=None, how='none')
    st, cn = region_bits(town.get('address') if town else None)
    hit.update(state=st, country=cn, at=today.isoformat())
    pins[key] = hit
    if hit['how'] != 'none': found += 1
    print(hit['how'].ljust(16), name, '|', loc)
    if looked % 20 == 0: json.dump(pins, open(PATH, 'w'), ensure_ascii=False, sort_keys=True, indent=0)
json.dump(pins, open(PATH, 'w'), ensure_ascii=False, sort_keys=True, indent=0)
from collections import Counter
print('looked up', looked, 'found', found, '| all pins:', dict(Counter(v['how'].split(' ')[0] for v in pins.values())))
