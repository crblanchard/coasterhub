#!/usr/bin/env python3
"""Pull every park ThemeParks.wiki covers, with its attractions, into
tools/open-data/themeparks/parks.json (2026-11-19).

ThemeParks.wiki (api.themeparks.wiki, a free open-source API) lists the rides
that ~200 major parks show in their own apps. It does not say which rides are
coasters and has no stats, so it is used for two things only: confirming a
new coaster another source reports ("the park lists it"), and flagging an
operating coaster the park no longer lists ("may have closed"). Names and
locations only; nothing else is kept.

One request a second. Run from the repo root."""
import json, os, sys, time, urllib.request

API = 'https://api.themeparks.wiki/v1'
UA = 'coaster-open-dataset/0.1 (open data build)'
OUT = 'tools/open-data/themeparks/parks.json'

def get(path):
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(API + path, headers={'User-Agent': UA}), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print('retry', attempt + 1, path, e, file=sys.stderr); time.sleep(10 * (attempt + 1))
    raise SystemExit('ThemeParks.wiki did not answer')

parks = []
for d in get('/destinations')['destinations']:
    for p in d['parks']:
        time.sleep(1)
        kids = get('/entity/' + p['id'] + '/children').get('children', [])
        rides = []
        for k in kids:
            if k.get('entityType') != 'ATTRACTION': continue
            loc = k.get('location') or {}
            rides.append({'id': k['id'], 'name': k['name'], 'lat': loc.get('latitude'), 'lon': loc.get('longitude')})
        lats = [r['lat'] for r in rides if r['lat'] is not None]; lons = [r['lon'] for r in rides if r['lon'] is not None]
        parks.append({'id': p['id'], 'name': p['name'], 'destination': d['name'],
                      'lat': sum(lats) / len(lats) if lats else None, 'lon': sum(lons) / len(lons) if lons else None,
                      'rides': sorted(rides, key=lambda r: r['id'])})
parks.sort(key=lambda p: p['id'])
if len(parks) < 100: raise SystemExit('only %d parks: refusing to replace the last pull' % len(parks))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump({'source': 'ThemeParks.wiki', 'parks': parks}, open(OUT, 'w'), ensure_ascii=False, sort_keys=True, indent=0)
print(len(parks), 'parks,', sum(len(p['rides']) for p in parks), 'attractions ->', OUT, file=sys.stderr)
