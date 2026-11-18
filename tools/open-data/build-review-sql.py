#!/usr/bin/env python3
"""The review layer for /open-review: writes a migration with

  open_record_facts (source, ref, field, value, prec, cites_rcdb)
        every record's stats in our units, matched or not, so a link
        approved on the dashboard can copy them into open_facts at once
  open_items        Wikidata's records too (Coasterpedia/OSM come from 189)
  open_suggestions  (source, ref, coaster_id, score, reason)  links to approve
  open_adds         (park, name, status, refs)  open-source coasters at our
                    parks that match none of ours, to add to the open dataset

Decisions live in open_reviews (migration 192), which this never touches.
Usage: python3 -I tools/open-data/build-review-sql.py > migrations/NNN-open-data-review.sql"""
import json

wd = json.load(open('tools/open-data/wikidata-matches.json'))
src = json.load(open('tools/open-data/sources-matches.json'))
rv = json.load(open('tools/open-data/review.json'))
day = wd['retrieved']
def q(v): return 'NULL' if v is None or v == '' else ("'" + str(v).replace("'", "''") + "'")
def n(v): return 'NULL' if v is None else repr(float(v))

facts = []
for qid, f in wd['records'].items():
    for k, x in f.items(): facts.append(('wikidata', qid, k, x['v'], x['prec'], 1 if x['cites_rcdb'] else 0))
for key, f in src['records'].items():
    s, ref = key.split('|', 1)
    for k, (v, prec) in f.items(): facts.append((s, ref, k, v, prec, 0))
facts.sort(key=lambda r: (r[0], r[1], r[2]))

print("""-- Open dataset, review layer (tools/open-data/suggest-matches.py ->
-- build-review-sql.py), pulled %s. Nothing here touches `coasters`, and
-- approving on /open-review only changes the open dataset: the live site
-- keeps reading the current data until the one-time switch (Carter,
-- 2026-11-18: "create a list of changes/secondary database until it's in
-- good shape. then at once flip"). Decisions are in open_reviews (192),
-- which this file never touches. Re-runnable.
CREATE TABLE IF NOT EXISTS open_items (source TEXT NOT NULL, ref TEXT NOT NULL, name TEXT, park TEXT, lat REAL, lon REAL, retrieved TEXT, PRIMARY KEY (source, ref));
CREATE TABLE IF NOT EXISTS open_record_facts (source TEXT NOT NULL, ref TEXT NOT NULL, field TEXT NOT NULL, value TEXT, prec TEXT, cites_rcdb INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (source, ref, field));
CREATE TABLE IF NOT EXISTS open_suggestions (source TEXT NOT NULL, ref TEXT NOT NULL, coaster_id INTEGER NOT NULL, score REAL, reason TEXT, PRIMARY KEY (source, ref, coaster_id));
CREATE TABLE IF NOT EXISTS open_adds (park TEXT NOT NULL, name TEXT NOT NULL, status TEXT, refs TEXT, PRIMARY KEY (park, name));
DELETE FROM open_items WHERE source = 'wikidata';
DELETE FROM open_record_facts;
DELETE FROM open_suggestions;
DELETE FROM open_adds;""" % day)
def chunks(rows, size=250):
    for i in range(0, len(rows), size): yield rows[i:i + size]
for c in chunks(rv['records']):
    print("INSERT OR REPLACE INTO open_items (source, ref, name, park, lat, lon, retrieved) VALUES %s;"
          % ','.join("('wikidata',%s,%s,%s,%s,%s,%s)" % (q(r['ref']), q(r['name']), q(r['park']), n(r['lat']), n(r['lon']), q(day)) for r in c))
for c in chunks(facts, 300):
    print("INSERT OR REPLACE INTO open_record_facts (source, ref, field, value, prec, cites_rcdb) VALUES %s;"
          % ','.join('(%s,%s,%s,%s,%s,%d)' % (q(a), q(b), q(k), q(v), q(p), rc) for a, b, k, v, p, rc in c))
for c in chunks(rv['suggestions']):
    print("INSERT OR REPLACE INTO open_suggestions (source, ref, coaster_id, score, reason) VALUES %s;"
          % ','.join('(%s,%s,%d,%s,%s)' % (q(s['source']), q(s['ref']), s['coaster_id'], s['score'], q(s['reason'])) for s in c))
for c in chunks(rv['adds']):
    print("INSERT OR REPLACE INTO open_adds (park, name, status, refs) VALUES %s;"
          % ','.join('(%s,%s,%s,%s)' % (q(a['park']), q(a['name']), q(a['status']), q(json.dumps(a['refs'], sort_keys=True))) for a in c))
