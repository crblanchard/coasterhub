#!/usr/bin/env python3
"""Pull every roller coaster infobox from Coasterpedia (coasterpedia.net,
CC BY-SA 4.0) into tools/open-data/coasterpedia/infoboxes.jsonl: one line per
page, {"title", "pageid", "revid", "params": {every infobox parameter}}.

Everything in the infobox is kept, raw but readable (wiki links reduced to
their text, comments and refs removed) — sorting through happens later
(Carter, 2026-11-18). Any parameter whose name mentions RCDB is dropped: no
RCDB identifier is ever stored.

Polite by design: the MediaWiki API, 50 pages per request, one request a
second, a descriptive User-Agent. Run from the repo root."""
import json, re, sys, time, urllib.parse, urllib.request

API = 'https://coasterpedia.net/w/api.php'
UA = 'coaster-open-dataset/0.1 (open data build)'
OUT = 'tools/open-data/coasterpedia/infoboxes.jsonl'

def get(params):
    params = dict(params, format='json', formatversion='2')
    url = API + '?' + urllib.parse.urlencode(params)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print('retry', attempt + 1, e, file=sys.stderr); time.sleep(10 * (attempt + 1))
    raise SystemExit('Coasterpedia did not answer')

def clean(v):
    v = re.sub(r'<!--.*?-->', '', v, flags=re.S)
    v = re.sub(r'<ref[^>]*/>', '', v)
    v = re.sub(r'<ref[^>]*>.*?</ref>', '', v, flags=re.S)
    v = re.sub(r'<br\s*/?>', '; ', v)
    v = re.sub(r'<[^>]+>', '', v)
    v = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', v)     # [[A|b]] -> b
    v = re.sub(r'\[https?://\S+\s+([^\]]*)\]', r'\1', v)          # [url text] -> text
    v = re.sub(r"'{2,}", '', v)
    return re.sub(r'\s+', ' ', v).strip()

def infobox(text):
    m = re.search(r'\{\{\s*Infobox roller coaster', text, re.I)
    if not m: return None
    # The infobox runs to its matching }}; templates nest inside it.
    i, depth = m.start(), 0
    j = i
    while j < len(text):
        if text.startswith('{{', j): depth += 1; j += 2; continue
        if text.startswith('}}', j):
            depth -= 1; j += 2
            if depth == 0: break
            continue
        j += 1
    body = text[m.end():j - 2]
    # Split on | at the top level only (not inside [[...]] or {{...}}).
    parts, cur, d = [], '', 0
    k = 0
    while k < len(body):
        two = body[k:k + 2]
        if two in ('[[', '{{'): d += 1; cur += two; k += 2; continue
        if two in (']]', '}}'): d -= 1; cur += two; k += 2; continue
        if body[k] == '|' and d == 0: parts.append(cur); cur = ''; k += 1; continue
        cur += body[k]; k += 1
    parts.append(cur)
    out = {}
    for p in parts:
        if '=' not in p: continue
        key, val = p.split('=', 1)
        key = key.strip().lower()
        if not key or 'rcdb' in key: continue
        val = clean(val)
        if val: out[key] = val
    return out

titles, cont = [], {}
while True:
    j = get(dict(action='query', list='embeddedin', eititle='Template:Infobox roller coaster',
                 einamespace=0, eilimit='max', **cont))
    titles += [p['title'] for p in j['query']['embeddedin']]
    if 'continue' not in j: break
    cont = {'eicontinue': j['continue']['eicontinue']}
    time.sleep(1)
print(len(titles), 'pages', file=sys.stderr)

import os; os.makedirs(os.path.dirname(OUT), exist_ok=True)
rows = []
for i in range(0, len(titles), 50):
    j = get(dict(action='query', prop='revisions', rvprop='content|ids', rvslots='main', titles='|'.join(titles[i:i + 50])))
    for p in j['query']['pages']:
        if 'revisions' not in p: continue
        r = p['revisions'][0]
        box = infobox(r['slots']['main'].get('content', ''))
        if box is not None:
            rows.append({'title': p['title'], 'pageid': p['pageid'], 'revid': r['revid'], 'params': box})
    time.sleep(1)
rows.sort(key=lambda r: r['pageid'])
with open(OUT, 'w') as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False, sort_keys=True) + '\n')
print(len(rows), 'infoboxes ->', OUT, file=sys.stderr)
