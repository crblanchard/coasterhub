#!/usr/bin/env python3
"""gallery.json (gallery-pull.py) -> SQL for open_gallery: every Commons
photo of a coaster's category, keyed by the Wikidata item (source 'wikidata',
ref = Q-id, as in open_links), with gallery-pull.py's score.

  open_gallery (source, ref, file, url, thumb, width, height, author,
                license, license_url, nonfree, page, score, retrieved)

Replaces the table's rows each run.
Usage: python3 -I tools/open-data/build-gallery-sql.py > migrations/NNN-....sql"""
import json

d = json.load(open('tools/open-data/gallery.json'))
q = lambda v: 'NULL' if v is None or v == '' else (str(v) if isinstance(v, (int, float)) else "'" + str(v).replace("'", "''") + "'")
cols = ['ref', 'file', 'url', 'thumb', 'width', 'height', 'author', 'license', 'license_url', 'nonfree', 'page', 'score']
print('-- Commons category photos per coaster (gallery-pull.py, ' + d['retrieved'] + ').')
print('CREATE TABLE IF NOT EXISTS open_gallery (source TEXT NOT NULL, ref TEXT NOT NULL, file TEXT NOT NULL, url TEXT, thumb TEXT, width INTEGER, height INTEGER, author TEXT, license TEXT, license_url TEXT, nonfree INTEGER NOT NULL DEFAULT 0, page TEXT, score INTEGER NOT NULL DEFAULT 0, retrieved TEXT, PRIMARY KEY (source, ref, file));')
print('DELETE FROM open_gallery;')
# Zoomed-out first (Carter, 2026-11-24: "zoomed out photos showing as much
# of the ride as possible. or like a prominent element"). Nothing here can see
# a picture, but file names say a lot: photographers call the wide shot
# "overview", "aerial", "panorama", "from the ..."; close-ups say "train",
# "seat", "POV", "station". Added to gallery-pull.py's score at build time,
# so a better rule never needs a new pull.
import re
WIDE = re.compile(r'overview|aerial|panoram|skyline|from (the )?(ferris|wheel|tower|sky|air|above|parking|park)|bird|drone|whole|full (view|layout)|helix|lift ?hill|top ?hat|loop|drop|airtime|wave|camelback|inversion', re.I)
CLOSE = re.compile(r'\btrain|\bcar\b|cars\b|seat|restraint|lap ?bar|harness|pov|on-?ride|onride|close|detail|station|queue|platform|wheel(s|set| assembly)\b|bolt|support footing|footer|interior|inside|sign\b|logo|plaque|tribute|refurb|painting|maintenance|night', re.I)
for r in d['photos']:
    f = r.get('file') or ''
    r['score'] = (r.get('score') or 0) + (4 if WIDE.search(f) else 0) - (3 if CLOSE.search(f) else 0) \
        + (1 if (r.get('width') or 0) >= 1.6 * (r.get('height') or 1) else 0)
rows = d['photos']
for i in range(0, len(rows), 40):
    print('INSERT OR REPLACE INTO open_gallery (source, ' + ', '.join(cols) + ', retrieved) VALUES '
          + ', '.join("('wikidata', " + ', '.join(q(r.get(c)) for c in cols) + ', ' + q(d['retrieved']) + ')' for r in rows[i:i + 40]) + ';')
