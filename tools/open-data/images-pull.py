#!/usr/bin/env python3
"""Photos and logos for coasters, from the open sources (Carter, 2026-11-24:
"get pictures for each ride through one of the open sources ... and for
'logos' i want coaster logos still").

The Coasterpedia and English Wikipedia infoboxes already name a picture
(`image`) and often a logo (`logo`); this asks each wiki's API what those
files are: the address of the file and of a 1200px-wide copy, its size, who
made it, and its licence. Wikipedia's API answers for Commons files too.

Writes tools/open-data/images.json:
  [{source, ref, kind: image|logo, file, url, thumb, width, height,
    author, license, license_url, nonfree, page}]
`nonfree` is 1 when the wiki marks the file as non-free / fair use (most
logos are): such a file may only be shown under fair use, which is Carter's
call. build-images-sql.py turns this into a migration.

Polite: 50 files a request, a second between requests, a descriptive
User-Agent with no personal details. Run from the repo root."""
import json, re, sys, time, urllib.parse, urllib.request, html

UA = 'CoasterHubBot/1.0 (https://coasterhub.org)'
WIKI = {'coasterpedia': ('https://coasterpedia.net/w/api.php', 'tools/open-data/coasterpedia/infoboxes.jsonl'),
        'enwiki': ('https://en.wikipedia.org/w/api.php', 'tools/open-data/wikipedia/en.jsonl')}


def get(api, params):
    url = api + '?' + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print('retry', attempt + 1, e, file=sys.stderr)
            time.sleep(10 * (attempt + 1))
    raise SystemExit('gave up on ' + api)


def text(v):
    """extmetadata values are HTML; keep the words."""
    v = re.sub(r'<[^>]+>', '', v or '')
    return re.sub(r'\s+', ' ', html.unescape(v)).strip() or None


def filename(v):
    v = re.sub(r'^\s*(\[\[)?\s*(File|Image|Datei|Bild)\s*:', '', v or '', flags=re.I)
    v = re.split(r'[|\]]', v)[0].strip()
    return v.replace('_', ' ') if re.search(r'\.(jpe?g|png|gif|svg|webp|tiff?)$', v, re.I) else None


out = []
for source, (api, dump) in WIKI.items():
    wanted = {}  # file -> [(ref, kind)]
    for line in open(dump):
        rec = json.loads(line)
        for kind, keys in (('image', ('image', 'image1', 'photo')), ('logo', ('logo',))):
            for k in keys:
                f = filename(rec['params'].get(k))
                if f:
                    wanted.setdefault(f, []).append((rec['title'], kind))
                    break
    files = sorted(wanted)
    print(source, len(files), 'files', file=sys.stderr)
    for i in range(0, len(files), 50):
        batch = files[i:i + 50]
        d = get(api, {'action': 'query', 'format': 'json', 'formatversion': 2, 'prop': 'imageinfo',
                      'iiprop': 'url|size|extmetadata|mime', 'iiurlwidth': 1200,
                      'titles': '|'.join('File:' + f for f in batch)})
        norm = {n['to']: n['from'] for n in d.get('query', {}).get('normalized', [])}
        for p in d.get('query', {}).get('pages', []):
            ii = (p.get('imageinfo') or [None])[0]
            if not ii:
                continue
            title = norm.get(p['title'], p['title'])
            f = title.split(':', 1)[1]
            m = ii.get('extmetadata') or {}
            mv = lambda k: (m.get(k) or {}).get('value')
            nonfree = 1 if str(mv('NonFree') or '').lower() == 'true' or re.search(r'fair use|non-free', str(mv('LicenseShortName') or ''), re.I) else 0
            for ref, kind in wanted.get(f, wanted.get(f.replace('_', ' '), [])):
                out.append({'source': source, 'ref': ref, 'kind': kind, 'file': f,
                            'url': ii.get('url'), 'thumb': ii.get('thumburl') or ii.get('url'),
                            'width': ii.get('thumbwidth') or ii.get('width'), 'height': ii.get('thumbheight') or ii.get('height'),
                            'author': text(mv('Artist')), 'license': text(mv('LicenseShortName')),
                            'license_url': text(mv('LicenseUrl')), 'nonfree': nonfree,
                            'page': ii.get('descriptionurl')})
        time.sleep(1)

json.dump({'retrieved': time.strftime('%Y-%m-%d'), 'images': out}, open('tools/open-data/images.json', 'w'), indent=0, ensure_ascii=False)
print(len(out), 'pictures', file=sys.stderr)
