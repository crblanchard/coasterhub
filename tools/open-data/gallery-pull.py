#!/usr/bin/env python3
"""Every photo in each coaster's Wikimedia Commons category (Carter,
2026-11-24: pull each coaster's Commons photo folder and pick the best, and
let him choose the photo himself).

Wikidata gives most coasters a Commons category (P373, from
tools/open-data/wikidata/all.csv). One request per category lists up to 40 of
its files with their address, size, author and licence (generator=
categorymembers + prop=imageinfo). Each photo gets a `score` so the site can
pick a good default without anyone choosing:
  +3 wider than tall, +2 at least 1600px wide, +1 a JPEG,
  +2 the file name contains a word of the ride's name,
  -4 a logo, map, sign, plan, diagram, ticket, poster, construction shot,
     entrance, queue or station (those are rarely the ride itself).

Writes tools/open-data/gallery.json: {retrieved, photos: [{ref (Q-id), file,
url, thumb, width, height, author, license, license_url, nonfree, page,
score}]}. Nothing is downloaded; Commons lets other sites show its images.
Resumable like images-pull.py. Polite: a second between requests, a
descriptive User-Agent with no personal details. Run from the repo root."""
import csv, html, json, re, sys, time, urllib.parse, urllib.request

UA = 'CoasterHubBot/1.0 (https://coasterhub.org)'
API = 'https://commons.wikimedia.org/w/api.php'
OUT = 'tools/open-data/gallery.json'
PER = 40
BAD = re.compile(r'logo|map\b|karte|plan\b|diagram|sign\b|schild|ticket|poster|construction|bau\b|entrance|eingang|queue|station|plaque|layout|track ?plan', re.I)


def get(params):
    url = API + '?' + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print('retry', attempt + 1, e, file=sys.stderr, flush=True)
            time.sleep(5 * (attempt + 1))
    return None


def text(v):
    v = re.sub(r'<[^>]+>', '', v or '')
    return re.sub(r'\s+', ' ', html.unescape(v)).strip() or None


def taken(v):
    """When the photo was taken (Commons' DateTimeOriginal, from the camera or
    the photographer), as YYYY-MM-DD, YYYY-MM or YYYY; None when unknown.
    (Carter, 2026-11-25: dates in the photo credit.)"""
    t = text(v) or ''
    m = re.search(r'(1[89]\d\d|20\d\d)[-:./](\d{1,2})(?:[-:./](\d{1,2}))?', t)
    if m and 1 <= int(m.group(2)) <= 12:
        return m.group(1) + '-' + m.group(2).zfill(2) + ('-' + m.group(3).zfill(2) if m.group(3) and 1 <= int(m.group(3)) <= 31 else '')
    m = re.search(r'\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? (?:\d{1,2},? )?(1[89]\d\d|20\d\d)\b', t, re.I)
    if m:
        return m.group(2) + '-' + str('janfebmaraprmayjunjulaugsepoctnovdec'.index(m.group(1).lower()[:3]) // 3 + 1).zfill(2)
    m = re.search(r'\b(1[89]\d\d|20\d\d)\b', t)
    return m.group(1) if m else None


cats = {}  # qid -> category
for row in csv.DictReader(open('tools/open-data/wikidata/all.csv')):
    if row['pid'] == 'P373' and row['val']:
        cats.setdefault(row['c'].rsplit('/', 1)[-1], row['val'])

try:
    prev = json.load(open(OUT))
    out, done = prev['photos'], set(prev.get('done', []))
    if out and not all('taken' in x for x in out):   # pulled before dates were kept
        out, done = [], set()
except Exception:
    out, done = [], set()


def save():
    json.dump({'retrieved': time.strftime('%Y-%m-%d'), 'done': sorted(done), 'photos': out},
              open(OUT, 'w'), indent=0, ensure_ascii=False)


todo = [q for q in sorted(cats) if q not in done]
print(len(cats), 'categories,', len(todo), 'to ask', file=sys.stderr, flush=True)
for n, qid in enumerate(todo):
    cat = cats[qid]
    d = get({'action': 'query', 'format': 'json', 'formatversion': 2, 'generator': 'categorymembers',
             'gcmtitle': 'Category:' + cat, 'gcmtype': 'file', 'gcmlimit': PER,
             'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata|mime', 'iiurlwidth': 1200})
    if d is None:
        print('Commons refused; stopping this run (it resumes)', file=sys.stderr, flush=True)
        break
    words = [w for w in re.findall(r'[a-z0-9]{3,}', cat.lower()) if w not in ('the', 'and', 'roller', 'coaster')]
    for p in (d.get('query') or {}).get('pages', []):
        ii = (p.get('imageinfo') or [None])[0]
        if not ii or not str(ii.get('mime', '')).startswith('image/'):
            continue
        f = p['title'].split(':', 1)[1]
        m = ii.get('extmetadata') or {}
        mv = lambda k: (m.get(k) or {}).get('value')
        lic = text(mv('LicenseShortName'))
        w, h = ii.get('width') or 0, ii.get('height') or 0
        score = (3 if w > h else 0) + (2 if w >= 1600 else 0) + (1 if ii.get('mime') == 'image/jpeg' else 0) \
            + (2 if any(x in f.lower() for x in words) else 0) - (4 if BAD.search(f) else 0)
        out.append({'ref': qid, 'file': f, 'url': ii.get('url'), 'thumb': ii.get('thumburl') or ii.get('url'),
                    'width': ii.get('thumbwidth') or w, 'height': ii.get('thumbheight') or h,
                    'author': text(mv('Artist')), 'license': lic, 'license_url': text(mv('LicenseUrl')),
                    'nonfree': 1 if (not lic) or re.search(r'fair use|non-free|copyright', lic, re.I) else 0,
                    'page': ii.get('descriptionurl'), 'score': score, 'taken': taken(mv('DateTimeOriginal'))})
    done.add(qid)
    if n % 25 == 0:
        save()
        print(n, '/', len(todo), file=sys.stderr, flush=True)
    time.sleep(1)
save()
print(len(out), 'photos from', len(done), 'categories', file=sys.stderr)
