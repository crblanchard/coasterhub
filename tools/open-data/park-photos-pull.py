#!/usr/bin/env python3
"""Photos of each park, from Wikimedia Commons (Carter, 2026-11-25: "i'm sure
there are open source park photos too can we load those in on park pages as
well ... want to be able to scroll through them the same way").

Which Wikidata item is a park comes from its coasters: the item most of a
park's linked coasters name as "part of" (P361) or "location" (P276). The
workflow asks D1 for that and writes tools/open-data/park-qids.json
([{park, q, lbl}]). An item whose label shares no real word with the park's
name is dropped (a coaster that moved, a resort, a city: "Cavallino Matto" ->
Canada's Wonderland, "Yokohama Cosmoworld" -> Yokohama).

For each item, Wikidata gives its Commons category (P373) and main image
(P18); one Commons request lists up to 40 files of the category with their
address, size, author and licence. Each photo gets a score so the page can
lead with a good one: wide and big, named after the park, the item's own main
image; logos, maps, plans, signs and tickets marked down.

Writes tools/open-data/park-gallery.json: {retrieved, done, photos:[{park, q,
file, url, thumb, width, height, author, license, license_url, nonfree, page,
score}]}. Nothing is downloaded; Commons lets other sites show its images.
Resumable. Polite: a second between requests, a descriptive User-Agent with no
personal details. Run from the repo root."""
import html, json, re, sys, time, urllib.parse, urllib.request

UA = 'CoasterHubBot/1.0 (https://coasterhub.org)'
WD = 'https://www.wikidata.org/w/api.php'
COMMONS = 'https://commons.wikimedia.org/w/api.php'
OUT = 'tools/open-data/park-gallery.json'
PER = 40
BAD = re.compile(r'logo|map\b|karte|plan\b|diagram|sign\b|schild|ticket|poster|brochure|leaflet|flyer|coat of arms|wappen|construction|bau\b|aerial view of the parking|parking', re.I)
GOOD = re.compile(r'overview|aerial|panoram|skyline|entrance|gate|from (the )?(ferris|wheel|tower|sky|air|above)|view', re.I)
GENERIC = {'park', 'parks', 'amusement', 'theme', 'the', 'and', 'of', 'de', 'la', 'le', 'world', 'land', 'resort', 'family',
           'fun', 'adventure', 'water', 'city', 'kingdom', 'pleasure', 'beach', 'parc', 'parque', 'attractiepark', 'freizeitpark'}


def get(api, params):
    url = api + '?' + urllib.parse.urlencode(dict(params, format='json', formatversion=2))
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print('retry', attempt + 1, e, file=sys.stderr, flush=True)
            time.sleep(5 * (attempt + 1))
    return None


def words(s):
    return {w for w in re.findall(r'[a-z0-9]{3,}', (s or '').lower()) if w not in GENERIC}


def text(v):
    v = re.sub(r'<[^>]+>', '', v or '')
    return re.sub(r'\s+', ' ', html.unescape(v)).strip() or None


rows = json.load(open('tools/open-data/park-qids.json'))
parks = {}   # q -> [park names]
for r in rows:
    if not r.get('q') or not r.get('park'):
        continue
    if not (words(r['park']) & words(r.get('lbl') or '')):
        print('skip', r['park'], '->', r.get('lbl'), file=sys.stderr)
        continue
    parks.setdefault(r['q'], []).append(r['park'])

try:
    prev = json.load(open(OUT))
    out, done = prev['photos'], set(prev.get('done', []))
except Exception:
    out, done = [], set()


def save():
    json.dump({'retrieved': time.strftime('%Y-%m-%d'), 'done': sorted(done), 'photos': out}, open(OUT, 'w'), indent=0, ensure_ascii=False)


todo = [q for q in sorted(parks) if q not in done]
print(len(parks), 'park items,', len(todo), 'to ask', file=sys.stderr, flush=True)
# Category and main image, 50 items a request.
meta = {}
for i in range(0, len(todo), 50):
    d = get(WD, {'action': 'wbgetentities', 'ids': '|'.join(todo[i:i + 50]), 'props': 'claims'})
    if d is None:
        print('Wikidata refused; stopping (it resumes)', file=sys.stderr)
        break
    for q, e in (d.get('entities') or {}).items():
        cl = e.get('claims') or {}
        val = lambda p: [((c.get('mainsnak') or {}).get('datavalue') or {}).get('value') for c in cl.get(p, [])]
        meta[q] = {'cat': next((v for v in val('P373') if isinstance(v, str)), None),
                   'img': next((v for v in val('P18') if isinstance(v, str)), None)}
    time.sleep(1)

for n, q in enumerate(todo):
    m = meta.get(q)
    if not m:
        continue
    files = {}
    if m['cat']:
        d = get(COMMONS, {'action': 'query', 'generator': 'categorymembers', 'gcmtitle': 'Category:' + m['cat'],
                          'gcmtype': 'file', 'gcmlimit': PER, 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata|mime', 'iiurlwidth': 1280})
        if d is None:
            print('Commons refused; stopping (it resumes)', file=sys.stderr)
            break
        for p in (d.get('query') or {}).get('pages', []):
            files[p['title']] = p
        time.sleep(1)
    if m['img'] and ('File:' + m['img']) not in files:
        d = get(COMMONS, {'action': 'query', 'titles': 'File:' + m['img'], 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata|mime', 'iiurlwidth': 1280})
        for p in ((d or {}).get('query') or {}).get('pages', []):
            files[p['title']] = p
        time.sleep(1)
    names = set().union(*[words(x) for x in parks[q]])
    for title, p in files.items():
        ii = (p.get('imageinfo') or [None])[0]
        if not ii or not str(ii.get('mime', '')).startswith('image/') or str(ii.get('mime')) == 'image/svg+xml':
            continue
        f = title.split(':', 1)[1]
        md = ii.get('extmetadata') or {}
        mv = lambda k: (md.get(k) or {}).get('value')
        lic = text(mv('LicenseShortName'))
        w, h = ii.get('width') or 0, ii.get('height') or 0
        score = (3 if w > h else 0) + (2 if w >= 1600 else 0) + (1 if ii.get('mime') == 'image/jpeg' else 0) \
            + (2 if any(x in f.lower() for x in names) else 0) + (3 if GOOD.search(f) else 0) \
            + (4 if m['img'] and f == m['img'] else 0) - (5 if BAD.search(f) else 0)
        for park in parks[q]:
            out.append({'park': park, 'q': q, 'file': f, 'url': ii.get('url'), 'thumb': ii.get('thumburl') or ii.get('url'),
                        'width': ii.get('thumbwidth') or w, 'height': ii.get('thumbheight') or h,
                        'author': text(mv('Artist')), 'license': lic, 'license_url': text(mv('LicenseUrl')),
                        'nonfree': 1 if (not lic) or re.search(r'fair use|non-free|copyright', lic, re.I) else 0,
                        'page': ii.get('descriptionurl'), 'score': score})
    done.add(q)
    if n % 20 == 0:
        save()
        print(n, '/', len(todo), file=sys.stderr, flush=True)
save()
print(len(out), 'photos for', len(done), 'park items', file=sys.stderr)
