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
        'enwiki': ('https://en.wikipedia.org/w/api.php', 'tools/open-data/wikipedia/en.jsonl'),
        # Wikidata's image (P18) and logo (P154) are Commons files; the ref is
        # the item's Q-id, as in open_links. (Carter, 2026-11-24: "start the
        # wikidata photo setup".) Commons lets other sites show its images.
        'wikidata': ('https://commons.wikimedia.org/w/api.php', 'tools/open-data/wikidata/all.csv')}


def wikidata_wanted(path):
    import csv
    wanted = {}
    for row in csv.DictReader(open(path)):
        kind = {'P18': 'image', 'P154': 'logo'}.get(row['pid'])
        if not kind or 'Special:FilePath/' not in row['val']:
            continue
        f = urllib.parse.unquote(row['val'].split('Special:FilePath/', 1)[1]).replace('_', ' ')
        qid = row['c'].rsplit('/', 1)[-1]
        if (qid, kind) not in {(q, k) for q, k in wanted.get(f, [])}:
            wanted.setdefault(f, []).append((qid, kind))
    # Every image (a racing pair's item often has one per side: YoY's
    # "...-yoy-chill.jpg" and "...-yoy-thrill.jpg", Carter 2026-11-24), but
    # one logo per item: the first named.
    seen, keep = set(), {}
    for f in sorted(wanted):
        for qid, kind in wanted[f]:
            if kind == 'logo' and (qid, kind) in seen:
                continue
            seen.add((qid, kind))
            keep.setdefault(f, []).append((qid, kind))
    return keep


def get(api, params):
    url = api + '?' + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print('retry', attempt + 1, e, file=sys.stderr, flush=True)
            time.sleep(5 * (attempt + 1))
    return None   # a refused source (429) is skipped this run, not fatal


def text(v):
    """extmetadata values are HTML; keep the words."""
    v = re.sub(r'<[^>]+>', '', v or '')
    return re.sub(r'\s+', ' ', html.unescape(v)).strip() or None


def filename(v):
    v = re.sub(r'^\s*(\[\[)?\s*(File|Image|Datei|Bild)\s*:', '', v or '', flags=re.I)
    v = re.split(r'[|\]]', v)[0].strip()
    return v.replace('_', ' ') if re.search(r'\.(jpe?g|png|gif|svg|webp|tiff?)$', v, re.I) else None


# Which sources: all by default, or the ones named (python3 images-pull.py coasterpedia).
PICK = sys.argv[1:] or list(WIKI)
OUT = 'tools/open-data/images.json'
# Resumable: what an earlier, interrupted run already fetched is kept and not
# asked again; the file is rewritten after every batch.
try:
    prev = json.load(open(OUT))['images']
except Exception:
    prev = []
out = [x for x in prev if x['source'] not in PICK] + [x for x in prev if x['source'] in PICK]
done = {(x['source'], x['file']) for x in out}
def save():
    json.dump({'retrieved': time.strftime('%Y-%m-%d'), 'images': out}, open(OUT, 'w'), indent=0, ensure_ascii=False)
for source, (api, dump) in WIKI.items():
    if source not in PICK:
        continue
    wanted = {}  # file -> [(ref, kind)]
    for line in ([] if source == 'wikidata' else open(dump)):
        rec = json.loads(line)
        for kind, keys in (('image', ('image', 'image1', 'photo')), ('logo', ('logo',))):
            for k in keys:
                f = filename(rec['params'].get(k))
                if f:
                    wanted.setdefault(f, []).append((rec['title'], kind))
                    break
    if source == 'wikidata':
        wanted = wikidata_wanted(dump)
    files = sorted(f for f in wanted if (source, f) not in done)
    print(source, len(files), 'files', file=sys.stderr)
    for i in range(0, len(files), 20):   # 20, not 50: Coasterpedia times out on 50 with licences
        batch = files[i:i + 20]
        d = get(api, {'action': 'query', 'format': 'json', 'formatversion': 2, 'prop': 'imageinfo',
                      'iiprop': 'url|size|extmetadata|mime', 'iiurlwidth': 1200,
                      'titles': '|'.join('File:' + f for f in batch)})
        if d is None:
            print(source, 'refused; skipping the rest of it this run', file=sys.stderr, flush=True)
            break
        if i % 200 == 0:
            print(source, i, '/', len(files), file=sys.stderr, flush=True)
        norm = {n['to']: n['from'] for n in d.get('query', {}).get('normalized', [])}
        for p in d.get('query', {}).get('pages', []):
            ii = (p.get('imageinfo') or [None])[0]
            if not ii:
                continue
            title = norm.get(p['title'], p['title'])
            f = title.split(':', 1)[1]
            m = ii.get('extmetadata') or {}
            mv = lambda k: (m.get(k) or {}).get('value')
            nonfree = 1 if str(mv('NonFree') or '').lower() == 'true' or re.search(r'fair use|non-free|copyright', str(mv('LicenseShortName') or ''), re.I) or not mv('LicenseShortName') else 0
            for ref, kind in wanted.get(f, wanted.get(f.replace('_', ' '), [])):
                out.append({'source': source, 'ref': ref, 'kind': kind, 'file': f,
                            'url': ii.get('url'), 'thumb': ii.get('thumburl') or ii.get('url'),
                            'width': ii.get('thumbwidth') or ii.get('width'), 'height': ii.get('thumbheight') or ii.get('height'),
                            'author': text(mv('Artist')), 'license': text(mv('LicenseShortName')),
                            'license_url': text(mv('LicenseUrl')), 'nonfree': nonfree,
                            'page': ii.get('descriptionurl')})
        save()
        time.sleep(1)

save()
print(len(out), 'pictures', file=sys.stderr)
