#!/usr/bin/env bash
# Pulls every roller coaster in OpenStreetMap (attraction=roller_coaster, ODbL,
# "(c) OpenStreetMap contributors") with all its tags and a centre point, into
# tools/open-data/osm/coasters.json. Everything is kept; sorting through
# happens later (Carter, 2026-11-18).
#
# The public Overpass servers are often busy: tries each mirror in turn, with
# backoff, and refuses an answer that is not the JSON it asked for rather than
# replacing good data. Run from the repo root.
set -euo pipefail
out=tools/open-data/osm; mkdir -p "$out"
Q='[out:json][timeout:300];nwr["attraction"="roller_coaster"];out tags center qt;'
tmp=$(mktemp)
for try in 1 2 3 4; do
  for host in overpass-api.de overpass.kumi.systems overpass.private.coffee; do
    if curl -sS -m 330 -A "coaster-open-dataset/0.1 (open data build)" --data-urlencode "data=$Q" \
         "https://$host/api/interpreter" -o "$tmp" 2>/dev/null \
       && python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); assert len(d["elements"]) > 1000' "$tmp" 2>/dev/null; then
      # Sorted by type and id, tags sorted, so an unchanged answer is an unchanged file.
      python3 -I -c '
import json,sys
d=json.load(open(sys.argv[1]))
els=sorted(d["elements"], key=lambda e:(e["type"],e["id"]))
for e in els:
    c=e.get("center") or {}
    e["lat"]=e.get("lat",c.get("lat")); e["lon"]=e.get("lon",c.get("lon")); e.pop("center",None)
    # No RCDB identifier is ever stored: OSM carries rcdb_id / ref:rcdb tags on some.
    e["tags"]={k:v for k,v in e.get("tags",{}).items() if "rcdb" not in k.lower() and "rcdb" not in str(v).lower()}
json.dump({"source":"OpenStreetMap (ODbL)","elements":els},open(sys.argv[2],"w"),ensure_ascii=False,sort_keys=True,indent=0)
print(len(els),"OSM coasters from",sys.argv[3])' "$tmp" "$out/coasters.json" "$host"
      rm -f "$tmp"; exit 0
    fi
    echo "overpass $host failed (try $try): $(head -c 160 "$tmp" 2>/dev/null | tr '\n' ' ')" >&2
  done
  sleep $((try * 60))
done
rm -f "$tmp"; echo "no Overpass server answered" >&2; exit 1
