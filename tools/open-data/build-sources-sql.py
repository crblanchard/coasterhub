#!/usr/bin/env python3
"""Turn tools/open-data/sources-matches.json (Coasterpedia + OSM) into a
migration that loads them beside Wikidata, never touching `coasters`:

  open_items   (source, ref, name, park, lat, lon, retrieved)  every record
  open_raw     (source, ref, k, v)   every infobox parameter / OSM tag, raw
  open_matches (source, ref, coaster_id, method, status)  'linked' / 'ambiguous'
  open_links   and open_facts (migration 187's tables) for the linked ones,
               so every stat says which source it came from.

Only the sources present in the JSON are replaced, so a failed OSM pull leaves
last week's OSM rows alone. Usage:
  python3 -I tools/open-data/build-sources-sql.py > migrations/NNN-open-data-sources.sql"""
import json

m = json.load(open('tools/open-data/sources-matches.json'))
day = m['retrieved']
def q(v): return 'NULL' if v is None or v == '' else ("'" + str(v).replace("'", "''") + "'")
def n(v): return 'NULL' if v is None else repr(float(v))
srcs = sorted({i['source'] for i in m['items']})
inl = ', '.join(q(s) for s in srcs)
print("""-- Open dataset, more sources: %s, pulled %s by tools/open-data/
-- (coasterpedia-pull.py, osm-pull.sh -> match-sources.py -> build-sources-sql.py).
-- Coasterpedia is CC BY-SA 4.0 (coasterpedia.net); OpenStreetMap is ODbL,
-- (c) OpenStreetMap contributors. Every record is kept, matched or not, with all
-- its raw fields; nothing is dropped for looking wrong (Carter, 2026-11-18).
-- Linked records also go into open_links / open_facts beside Wikidata's, so
-- each stat names its source. Only these sources' rows are replaced; re-runnable.
CREATE TABLE IF NOT EXISTS open_links (coaster_id INTEGER NOT NULL, source TEXT NOT NULL, ref TEXT NOT NULL, method TEXT, added TEXT, PRIMARY KEY (coaster_id, source));
CREATE TABLE IF NOT EXISTS open_facts (coaster_id INTEGER NOT NULL, field TEXT NOT NULL, value TEXT, prec TEXT, source TEXT NOT NULL, ref TEXT, cites_rcdb INTEGER NOT NULL DEFAULT 0, retrieved TEXT, PRIMARY KEY (coaster_id, field, source));
CREATE TABLE IF NOT EXISTS open_items (source TEXT NOT NULL, ref TEXT NOT NULL, name TEXT, park TEXT, lat REAL, lon REAL, retrieved TEXT, PRIMARY KEY (source, ref));
CREATE TABLE IF NOT EXISTS open_raw (source TEXT NOT NULL, ref TEXT NOT NULL, k TEXT NOT NULL, v TEXT, PRIMARY KEY (source, ref, k));
CREATE TABLE IF NOT EXISTS open_matches (source TEXT NOT NULL, ref TEXT NOT NULL, coaster_id INTEGER NOT NULL, method TEXT, status TEXT NOT NULL, PRIMARY KEY (source, ref, coaster_id));
CREATE INDEX IF NOT EXISTS open_matches_coaster ON open_matches (coaster_id);
DELETE FROM open_items WHERE source IN (%s);
DELETE FROM open_raw WHERE source IN (%s);
DELETE FROM open_matches WHERE source IN (%s);
DELETE FROM open_links WHERE source IN (%s);
DELETE FROM open_facts WHERE source IN (%s);""" % (', '.join(srcs), day, inl, inl, inl, inl, inl))

def chunks(rows, size=200):
    for i in range(0, len(rows), size): yield rows[i:i + size]
for c in chunks(m['items']):
    print("INSERT OR REPLACE INTO open_items (source, ref, name, park, lat, lon, retrieved) VALUES %s;"
          % ','.join('(%s,%s,%s,%s,%s,%s,%s)' % (q(i['source']), q(i['ref']), q(i['name']), q(i['park']), n(i['lat']), n(i['lon']), q(day)) for i in c))
raw = [(i['source'], i['ref'], k, v) for i in m['items'] for k, v in sorted(i['raw'].items()) if 'rcdb' not in k.lower()]
for c in chunks(raw, 300):
    print("INSERT OR REPLACE INTO open_raw (source, ref, k, v) VALUES %s;" % ','.join('(%s,%s,%s,%s)' % tuple(q(x) for x in r) for r in c))
for c in chunks(m['matches']):
    print("INSERT OR REPLACE INTO open_matches (source, ref, coaster_id, method, status) VALUES %s;"
          % ','.join('(%s,%s,%d,%s,%s)' % (q(x['source']), q(x['ref']), x['coaster_id'], q(x['method']), q(x['status'])) for x in c))
links = [x for x in m['matches'] if x['status'] == 'linked']
for c in chunks(links):
    print("INSERT OR REPLACE INTO open_links (coaster_id, source, ref, method, added) SELECT v.column1, v.column2, v.column3, v.column4, v.column5 FROM (VALUES %s) v WHERE EXISTS (SELECT 1 FROM coasters c WHERE c.id = v.column1);"
          % ','.join('(%d,%s,%s,%s,%s)' % (x['coaster_id'], q(x['source']), q(x['ref']), q(x['method']), q(day)) for x in c))
for c in chunks(m['facts']):
    print("INSERT OR REPLACE INTO open_facts (coaster_id, field, value, prec, source, ref, cites_rcdb, retrieved) SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8 FROM (VALUES %s) v WHERE EXISTS (SELECT 1 FROM coasters c WHERE c.id = v.column1);"
          % ','.join('(%d,%s,%s,%s,%s,%s,0,%s)' % (f['coaster_id'], q(f['field']), q(f['value']), q(f['prec']), q(f['source']), q(f['ref']), q(day)) for f in c))
