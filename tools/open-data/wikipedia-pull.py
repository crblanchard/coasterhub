#!/usr/bin/env python3
"""Pull every roller coaster infobox from English and German Wikipedia
(CC BY-SA 4.0) into tools/open-data/wikipedia/<lang>.jsonl, one line per
article: {"title", "pageid", "revid", "params": {every infobox parameter}}
(2026-11-19; ThemeParks.wiki was tried the same day and dropped: "it doesn't
have that much").

  en  Template:Infobox roller coaster  (height_ft/_m, speed_mph/_kmh ...)
  de  Vorlage:Infobox Achterbahn       (HÖHE, LÄNGE in m, GESCHWINDIGKEIT km/h)

Wikimedia asks automated clients to say who they are and how to reach them,
and throttles the ones that don't: the User-Agent names Coaster Hub and its
site (Carter chose that over an email, 2026-11-19). One request a second,
maxlag respected. Templates that carry a value ({{Start date|2022|03|11}},
{{convert|206|ft}}) are reduced to it; every other template, ref and
comment is removed. Any parameter or value mentioning RCDB (English
infoboxes carry rcdb_number) is dropped: no RCDB identifier is ever stored.
Usage: python3 -I tools/open-data/wikipedia-pull.py [en] [de]"""
import json, os, re, sys, time, urllib.parse, urllib.request

UA = 'CoasterHubBot/1.0 (https://coasterhub.org)'
LANGS = {'en': 'Template:Infobox roller coaster', 'de': 'Vorlage:Infobox Achterbahn'}

def get(lang, params):
    params = dict(params, format='json', formatversion='2', maxlag='5')
    url = 'https://%s.wikipedia.org/w/api.php?%s' % (lang, urllib.parse.urlencode(params))
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                j = json.load(r)
            if j.get('error', {}).get('code') == 'maxlag': raise RuntimeError('maxlag')
            return j
        except Exception as e:
            print('retry', attempt + 1, e, file=sys.stderr); time.sleep(15 * (attempt + 1))
    raise SystemExit('Wikipedia (%s) did not answer' % lang)

def templates(v):
    # Value-carrying templates first, innermost out.
    for _ in range(4):
        v = re.sub(r'\{\{\s*(?:start date|end date|start date and age|end date and age|dts|Datum)\s*\|([^{}]*)\}\}',
                   lambda m: '-'.join(p.strip().zfill(2) if i else p.strip() for i, p in enumerate(
                       [x for x in m.group(1).split('|') if x.strip() and '=' not in x][:3])), v, flags=re.I)
        v = re.sub(r'\{\{\s*(?:convert|cvt)\s*\|\s*([\d.,]+)\s*\|\s*([^|{}]+)[^{}]*\}\}', r'\1 \2', v, flags=re.I)
        v = re.sub(r'\{\{\s*(?:duration)\s*\|([^{}]*)\}\}', lambda m: ':'.join(
            x.split('=')[1].strip() for x in m.group(1).split('|') if re.match(r'\s*[ms]\s*=', x)) or m.group(0), v, flags=re.I)
        v = re.sub(r'\{\{[^{}]*\}\}', '', v)
    return v

def clean(v):
    v = re.sub(r'<!--.*?-->', '', v, flags=re.S)
    v = re.sub(r'<ref[^>]*/>', '', v)
    v = re.sub(r'<ref[^>]*>.*?</ref>', '', v, flags=re.S)
    v = templates(v)
    v = re.sub(r'<br\s*/?>', '; ', v)
    v = re.sub(r'<[^>]+>', '', v)
    v = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', v)
    v = re.sub(r'\[https?://\S+\s+([^\]]*)\]', r'\1', v)
    v = re.sub(r"'{2,}", '', v).replace('&nbsp;', ' ')
    return re.sub(r'\s+', ' ', v).strip()

def infobox(text, name):
    m = re.search(r'\{\{\s*' + re.escape(name.split(':', 1)[1]) + r'\b', text, re.I)
    if not m: return None
    i, depth, j = m.start(), 0, m.start()
    while j < len(text):
        if text.startswith('{{', j): depth += 1; j += 2; continue
        if text.startswith('}}', j):
            depth -= 1; j += 2
            if depth == 0: break
            continue
        j += 1
    body = text[m.end():j - 2]
    parts, cur, d, k = [], '', 0, 0
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
        if not key or not re.fullmatch(r'[\w/ .-]+', key) or 'rcdb' in key: continue
        val = clean(val)
        if val and 'rcdb' not in val.lower(): out[key] = val
    return out

for lang in (sys.argv[1:] or list(LANGS)):
    tpl = LANGS[lang]
    titles, cont = [], {}
    while True:
        j = get(lang, dict(action='query', list='embeddedin', eititle=tpl, einamespace=0, eilimit='max', **cont))
        titles += [p['title'] for p in j['query']['embeddedin']]
        if 'continue' not in j: break
        cont = {'eicontinue': j['continue']['eicontinue']}
        time.sleep(1)
    print(lang, len(titles), 'articles', file=sys.stderr)
    rows = []
    for i in range(0, len(titles), 20):   # small batches, two seconds apart: Wikimedia throttles bursts
        j = get(lang, dict(action='query', prop='revisions', rvprop='content|ids', rvslots='main', titles='|'.join(titles[i:i + 20])))
        for p in j['query']['pages']:
            if 'revisions' not in p: continue
            r = p['revisions'][0]
            box = infobox(r['slots']['main'].get('content', ''), tpl)
            if box: rows.append({'title': p['title'], 'pageid': p['pageid'], 'revid': r['revid'], 'params': box})
        time.sleep(2)
    if len(rows) < 200: raise SystemExit('%s: only %d infoboxes, refusing to replace the last pull' % (lang, len(rows)))
    rows.sort(key=lambda r: r['pageid'])
    out = 'tools/open-data/wikipedia/%s.jsonl' % lang
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w') as f:
        for r in rows: f.write(json.dumps(r, ensure_ascii=False, sort_keys=True) + '\n')
    print(lang, len(rows), 'infoboxes ->', out, file=sys.stderr)
