#!/usr/bin/env python3
"""The raw layer: EVERYTHING Wikidata says about every roller coaster, kept
whether or not it matches one of ours and whether or not it looks right
(Carter, 2026-11-18: "want to build a database that has EVERYTHING wiki
includes even if it might not be right. Want to filter through instead of drop
data"). open_facts (migration 187) is the cleaned layer picked from this.

  wd_items   (qid, label, description, aliases, retrieved)   every item
  wd_props   (pid, label, type)                               properties used
  wd_claims  (qid, pid, value, value_label, amount, unit, prec, rank, cites_rcdb)
             one row per statement. Item values are Q-ids with value_label the
             English label; quantities keep Wikidata's own value in `value` and
             the SI-normalised one in `amount` / `unit` (a Q-id); dates keep
             the timestamp and its precision (9 year, 10 month, 11 day).
  wd_matches (qid, coaster_id, method, status)  status 'linked' (also in
             open_links) or 'ambiguous' (a candidate the matcher would not
             pick between, kept for review).

The RCDB ID property (P2751) is never pulled or stored.
Usage: python3 -I tools/open-data/build-raw-sql.py > migrations/NNN-....sql"""
import csv, json

W = 'tools/open-data/wikidata/'
E = 'http://www.wikidata.org/entity/'
def qid(u): return u[len(E):] if u.startswith(E) else u
def q(v): return 'NULL' if v is None or v == '' else "'" + str(v).replace("'", "''") + "'"

m = json.load(open('tools/open-data/wikidata-matches.json'))
day = m['retrieved']

desc = {qid(r['c']): r['desc'] for r in csv.DictReader(open(W + 'desc.csv'))}
items = {}
for r in csv.DictReader(open(W + 'base.csv')):
    k = qid(r['c'])
    if k in items: continue
    items[k] = (r['label'], desc.get(k), '|'.join(sorted(a for a in r['aliases'].split('|') if a)))

props = {}
for r in csv.DictReader(open(W + 'props.csv')):
    props[r['pid']] = (r['label'], r['type'].rsplit('#', 1)[-1])

claims = {}
for r in csv.DictReader(open(W + 'all.csv')):
    # The RCDB ID property, and any value mentioning RCDB: an rcdb.com
    # "described at URL" (P973) carries the ID in its address.
    if r['pid'] == 'P2751' or 'rcdb' in (r['val'] + r['valLabel']).lower(): continue
    key = (qid(r['c']), r['pid'], qid(r['val']))
    rc = 1 if r['rcdbRef'] == 'true' else 0
    old = claims.get(key)
    # The same statement comes back once per reference: it cites RCDB if any does.
    if old and old[-1] >= rc: continue
    claims[key] = (r['valLabel'], r['amt'], qid(r['unit']), r['prec'], r['rank'].rsplit('#', 1)[-1].replace('Rank', ''), rc)
    items.setdefault(key[0], (None, desc.get(key[0]), ''))

matches = [(v['qid'], int(k), v['method'], 'linked') for k, v in m['matches'].items()]
matches += [(a['qid'], a['coaster_id'], a['method'], 'ambiguous') for a in m['ambiguous']]

print("""-- Open dataset, raw layer: every Wikidata statement on every roller coaster
-- item (%d items, %d statements), pulled %s by tools/open-data/
-- (wikidata-pull.sh -> match-wikidata.py -> build-raw-sql.py). Nothing is
-- filtered out for looking wrong (Carter, 2026-11-18: "filter through instead
-- of drop data"); open_facts (187) is the cleaned layer. Items matching none
-- of our coasters are kept too. The RCDB ID property is never stored.
-- Safe to re-run: the tables are emptied and refilled.
CREATE TABLE IF NOT EXISTS wd_items (qid TEXT PRIMARY KEY, label TEXT, description TEXT, aliases TEXT, retrieved TEXT);
CREATE TABLE IF NOT EXISTS wd_props (pid TEXT PRIMARY KEY, label TEXT, type TEXT);
CREATE TABLE IF NOT EXISTS wd_claims (qid TEXT NOT NULL, pid TEXT NOT NULL, value TEXT NOT NULL, value_label TEXT, amount REAL, unit TEXT, prec INTEGER, rank TEXT, cites_rcdb INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (qid, pid, value));
CREATE INDEX IF NOT EXISTS wd_claims_pid ON wd_claims (pid);
CREATE TABLE IF NOT EXISTS wd_matches (qid TEXT NOT NULL, coaster_id INTEGER NOT NULL, method TEXT, status TEXT NOT NULL, PRIMARY KEY (qid, coaster_id));
CREATE INDEX IF NOT EXISTS wd_matches_coaster ON wd_matches (coaster_id);
DELETE FROM wd_items;
DELETE FROM wd_props;
DELETE FROM wd_claims;
DELETE FROM wd_matches;""" % (len(items), len(claims), day))

def chunks(rows, n=250):
    for i in range(0, len(rows), n): yield rows[i:i+n]
for c in chunks(sorted(items.items())):
    print("INSERT OR REPLACE INTO wd_items (qid, label, description, aliases, retrieved) VALUES %s;"
          % ','.join('(%s,%s,%s,%s,%s)' % (q(k), q(v[0]), q(v[1]), q(v[2]), q(day)) for k, v in c))
used = sorted({k[1] for k in claims})
for c in chunks(used):
    print("INSERT OR REPLACE INTO wd_props (pid, label, type) VALUES %s;"
          % ','.join('(%s,%s,%s)' % (q(p), q(props.get(p, (None,))[0]), q(props.get(p, (None, None))[1])) for p in c))
for c in chunks(sorted(claims.items())):
    print("INSERT OR REPLACE INTO wd_claims (qid, pid, value, value_label, amount, unit, prec, rank, cites_rcdb) VALUES %s;"
          % ','.join('(%s,%s,%s,%s,%s,%s,%s,%s,%d)' % (q(k[0]), q(k[1]), q(k[2]), q(v[0]), v[1] or 'NULL', q(v[2]), v[3] or 'NULL', q(v[4]), v[5]) for k, v in c))
for c in chunks(sorted(matches)):
    print("INSERT OR REPLACE INTO wd_matches (qid, coaster_id, method, status) VALUES %s;"
          % ','.join('(%s,%d,%s,%s)' % (q(a), b, q(c_), q(d)) for a, b, c_, d in c))
