#!/usr/bin/env python3
"""park-gallery.json (park-photos-pull.py) -> SQL for open_park_gallery: the
Commons photos of each park, keyed by our park name, with their score.

  open_park_gallery (park, file, q, url, thumb, width, height, author, license,
                     license_url, nonfree, page, score, retrieved)

Replaces the table's rows each run.
Usage: python3 -I tools/open-data/build-park-gallery-sql.py > migrations/NNN-....sql"""
import json

d = json.load(open('tools/open-data/park-gallery.json'))
q = lambda v: 'NULL' if v is None or v == '' else (str(v) if isinstance(v, (int, float)) else "'" + str(v).replace("'", "''") + "'")
cols = ['park', 'file', 'q', 'url', 'thumb', 'width', 'height', 'author', 'license', 'license_url', 'nonfree', 'page', 'score']
print('-- Commons photos per park (park-photos-pull.py, ' + d['retrieved'] + ').')
print('CREATE TABLE IF NOT EXISTS open_park_gallery (park TEXT NOT NULL, file TEXT NOT NULL, q TEXT, url TEXT, thumb TEXT, width INTEGER, height INTEGER, author TEXT, license TEXT, license_url TEXT, nonfree INTEGER NOT NULL DEFAULT 0, page TEXT, score INTEGER NOT NULL DEFAULT 0, retrieved TEXT, PRIMARY KEY (park, file));')
print('DELETE FROM open_park_gallery;')
rows = d['photos']
for i in range(0, len(rows), 40):
    print('INSERT OR REPLACE INTO open_park_gallery (' + ', '.join(cols) + ', retrieved) VALUES '
          + ', '.join('(' + ', '.join(q(r.get(c)) for c in cols) + ', ' + q(d['retrieved']) + ')' for r in rows[i:i + 40]) + ';')
