#!/usr/bin/env python3
"""images.json (images-pull.py) -> SQL for open_images, the photo and logo of
each source record, joined to coasters through open_links (source, ref).

  open_images (source, ref, kind, file, url, thumb, width, height, author,
               license, license_url, nonfree, page, retrieved)

Replaces the table's rows each run, so a picture taken down on the wiki goes
from the site at the next refresh.
Usage: python3 -I tools/open-data/build-images-sql.py > migrations/NNN-....sql"""
import json

d = json.load(open('tools/open-data/images.json'))
q = lambda v: 'NULL' if v is None or v == '' else (str(v) if isinstance(v, (int, float)) else "'" + str(v).replace("'", "''") + "'")
cols = ['source', 'ref', 'kind', 'file', 'url', 'thumb', 'width', 'height', 'author', 'license', 'license_url', 'nonfree', 'page', 'taken']
print('-- Photos and logos from Coasterpedia and English Wikipedia (images-pull.py, ' + d['retrieved'] + ').')
print('CREATE TABLE IF NOT EXISTS open_images (source TEXT NOT NULL, ref TEXT NOT NULL, kind TEXT NOT NULL, file TEXT NOT NULL DEFAULT \'\', url TEXT, thumb TEXT, width INTEGER, height INTEGER, author TEXT, license TEXT, license_url TEXT, nonfree INTEGER NOT NULL DEFAULT 0, page TEXT, retrieved TEXT, taken TEXT, PRIMARY KEY (source, ref, kind, file));')
print('DELETE FROM open_images;')
rows = d['images']
for i in range(0, len(rows), 40):
    print('INSERT OR REPLACE INTO open_images (' + ', '.join(cols) + ', retrieved) VALUES '
          + ', '.join('(' + ', '.join(q(r.get(c)) for c in cols) + ', ' + q(d['retrieved']) + ')' for r in rows[i:i + 40]) + ';')
