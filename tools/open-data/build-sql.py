#!/usr/bin/env python3
"""Turn tools/open-data/wikidata-matches.json into a migration that loads the
open (non-RCDB) dataset into D1 beside the live one, never touching `coasters`.

  open_links  (coaster_id, source, ref, method, added)
      which open record a coaster is: source 'wikidata', ref 'Q885897'.
  open_facts  (coaster_id, field, value, prec, source, ref, cites_rcdb, retrieved)
      one row per field per source: h, s, l, dur (ft / mph / seconds, like
      `coasters`), opened / closed (YYYY[-MM[-DD]] + prec), manu, type.
      cites_rcdb says Wikidata's own reference for the value points at RCDB;
      informational only (Carter, 2026-11-18: Wikidata copying RCDB is fine).

No RCDB identifier is read or stored. Re-running replaces this source's rows.
Usage: python3 -I tools/open-data/build-sql.py > migrations/NNN-....sql"""
import json, sys
m = json.load(open('tools/open-data/wikidata-matches.json'))
day, M = m['retrieved'], m['matches']
def q(v): return 'NULL' if v is None else "'" + str(v).replace("'", "''") + "'"
print("""-- Open dataset, layer 1: Wikidata (CC0), pulled %s by tools/open-data/
-- (wikidata-pull.sh -> match-wikidata.py -> build-sql.py). A parallel copy of
-- the coaster facts from open sources, kept beside `coasters` and never
-- written into it: the live site still reads `coasters` (Carter, 2026-11-18:
-- "keep all rcdb stats for now ... eventually want to" swap). /sources shows
-- the coverage. Matching is name + park (or Wikidata coordinates within 3 km
-- of the park); ambiguous items are left unmatched. Safe to re-run: this
-- source's rows are replaced wholesale.
CREATE TABLE IF NOT EXISTS open_links (coaster_id INTEGER NOT NULL, source TEXT NOT NULL, ref TEXT NOT NULL, method TEXT, added TEXT, PRIMARY KEY (coaster_id, source));
CREATE TABLE IF NOT EXISTS open_facts (coaster_id INTEGER NOT NULL, field TEXT NOT NULL, value TEXT, prec TEXT, source TEXT NOT NULL, ref TEXT, cites_rcdb INTEGER NOT NULL DEFAULT 0, retrieved TEXT, PRIMARY KEY (coaster_id, field, source));
CREATE INDEX IF NOT EXISTS open_facts_field ON open_facts (field);
DELETE FROM open_links WHERE source = 'wikidata';
DELETE FROM open_facts WHERE source = 'wikidata';""" % day)
links = [(int(k), v) for k, v in sorted(M.items(), key=lambda x: int(x[0]))]
for i in range(0, len(links), 250):
    rows = ','.join("(%d,'wikidata',%s,%s,%s)" % (k, q(v['qid']), q(v['method']), q(day)) for k, v in links[i:i+250])
    print("INSERT OR REPLACE INTO open_links (coaster_id, source, ref, method, added) SELECT v.column1, v.column2, v.column3, v.column4, v.column5 FROM (VALUES %s) v WHERE EXISTS (SELECT 1 FROM coasters c WHERE c.id = v.column1);" % rows)
facts = [(k, f, x, v['qid']) for k, v in links for f, x in sorted(v['facts'].items())]
for i in range(0, len(facts), 250):
    rows = ','.join("(%d,%s,%s,%s,'wikidata',%s,%d,%s)" % (k, q(f), q(x['v']), q(x['prec']), q(ref), 1 if x['cites_rcdb'] else 0, q(day)) for k, f, x, ref in facts[i:i+250])
    print("INSERT OR REPLACE INTO open_facts (coaster_id, field, value, prec, source, ref, cites_rcdb, retrieved) SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8 FROM (VALUES %s) v WHERE EXISTS (SELECT 1 FROM coasters c WHERE c.id = v.column1);" % rows)
