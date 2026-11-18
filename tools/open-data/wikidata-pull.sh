#!/usr/bin/env bash
# Pulls every roller coaster Wikidata knows (CC0) into tools/open-data/wikidata/*.csv.
# Three queries, kept apart so none times out:
#   base.csv   item, English label + aliases, country, coordinates, makers,
#              park candidates (part of / location / admin area), OSM ids
#   stats.csv  height / length / speed / duration, normalised to metres,
#              metres per second and seconds (psn:), with whether the
#              statement's own reference points at RCDB
#   dates.csv  opening and closing dates the same way
#   all.csv    EVERY statement on every roller coaster item (2026-11-18,
#              Carter: "a database that has EVERYTHING wiki includes even if
#              it might not be right"), except the RCDB ID property P2751,
#              which is never stored, nor any value mentioning RCDB (an
#              rcdb.com "described at URL" carries the ID). SI-normalised too.
#   props.csv  English label and datatype of every property used in all.csv
#   desc.csv   English description of every item
# Run from the repo root: bash tools/open-data/wikidata-pull.sh
set -euo pipefail
out=tools/open-data/wikidata; mkdir -p "$out"
# Wikidata answers a busy moment with an error page instead of CSV (seen from
# GitHub's runners). Each query is retried, and an answer that is not CSV, or
# is suspiciously short, fails the run rather than replacing good data.
q(){
  local tmp; tmp=$(mktemp)
  for try in 1 2 3 4 5; do
    if curl -sS -m 300 -G "https://query.wikidata.org/sparql" -H "Accept: text/csv" \
         -H "User-Agent: coaster-open-dataset/0.1 (open data build)" --data-urlencode "query=$1" -o "$tmp" \
       && head -1 "$tmp" | grep -qE '^[a-zA-Z]+(,[a-zA-Z]+)*\s*$' && [ "$(wc -l < "$tmp")" -gt 100 ]; then
      # Sorted, so an unchanged answer is an unchanged file (row order varies).
      { head -1 "$tmp"; tail -n +2 "$tmp" | LC_ALL=C sort; }; rm -f "$tmp"; return 0
    fi
    echo "query failed (try $try): $(head -c 200 "$tmp" | tr '\n' ' ')" >&2
    sleep $((try * 30))
  done
  rm -f "$tmp"; return 1
}
RC='?c wdt:P31/wdt:P279* wd:Q204832 .'
REF='OPTIONAL { ?st prov:wasDerivedFrom ?ref . ?ref ?rp ?rv . FILTER(CONTAINS(LCASE(STR(?rv)), "rcdb") || ?rp = pr:P2751) }
     BIND(BOUND(?rv) AS ?rcdbRef)'
q "SELECT ?c ?label (GROUP_CONCAT(DISTINCT ?alias; separator='|') AS ?aliases) ?country
          (SAMPLE(?coord) AS ?coord) (GROUP_CONCAT(DISTINCT ?makerL; separator='|') AS ?makers)
          (GROUP_CONCAT(DISTINCT ?partL; separator='|') AS ?partOf) (GROUP_CONCAT(DISTINCT ?locL; separator='|') AS ?location)
          (GROUP_CONCAT(DISTINCT ?typeL; separator='|') AS ?types) (GROUP_CONCAT(DISTINCT ?matL; separator='|') AS ?material)
          (SAMPLE(?osmw) AS ?osmWay) (SAMPLE(?osmn) AS ?osmNode) (SAMPLE(?cc) AS ?captainCoaster)
  WHERE { $RC
    OPTIONAL { ?c rdfs:label ?label FILTER(LANG(?label)='en') }
    OPTIONAL { ?c skos:altLabel ?alias FILTER(LANG(?alias)='en') }
    OPTIONAL { ?c wdt:P17/rdfs:label ?country FILTER(LANG(?country)='en') }
    OPTIONAL { ?c wdt:P625 ?coord }
    OPTIONAL { ?c wdt:P176/rdfs:label ?makerL FILTER(LANG(?makerL)='en') }
    OPTIONAL { ?c wdt:P361/rdfs:label ?partL FILTER(LANG(?partL)='en') }
    OPTIONAL { ?c wdt:P276/rdfs:label ?locL FILTER(LANG(?locL)='en') }
    OPTIONAL { ?c wdt:P31/rdfs:label ?typeL FILTER(LANG(?typeL)='en') }
    OPTIONAL { ?c wdt:P186/rdfs:label ?matL FILTER(LANG(?matL)='en') }
    OPTIONAL { ?c wdt:P10689 ?osmw } OPTIONAL { ?c wdt:P11693 ?osmn } OPTIONAL { ?c wdt:P13376 ?cc }
  } GROUP BY ?c ?label ?country" > "$out/base.csv"
q "SELECT ?c ?field ?value ?rcdbRef WHERE { $RC
    VALUES (?prop ?psn ?field) { (p:P2048 psn:P2048 'height_m') (p:P2043 psn:P2043 'length_m')
                                 (p:P2052 psn:P2052 'speed_ms') (p:P2047 psn:P2047 'duration_s') }
    ?c ?prop ?st . ?st ?psn ?nv . ?nv wikibase:quantityAmount ?value .
    $REF }" > "$out/stats.csv"
q "SELECT ?c ?field ?value ?prec ?rcdbRef WHERE { $RC
    VALUES (?prop ?ps ?psv ?field) { (p:P1619 ps:P1619 psv:P1619 'opened') (p:P571 ps:P571 psv:P571 'opened')
                                     (p:P729 ps:P729 psv:P729 'opened') (p:P3999 ps:P3999 psv:P3999 'closed')
                                     (p:P576 ps:P576 psv:P576 'closed') (p:P730 ps:P730 psv:P730 'closed') }
    ?c ?prop ?st . ?st ?ps ?value . ?st ?psv ?tv . ?tv wikibase:timePrecision ?prec .
    $REF }" > "$out/dates.csv"
q "SELECT ?c ?pid ?val ?valLabel ?amt ?unit ?prec ?rank ?rcdbRef WHERE { $RC
    ?c ?p ?st . ?prop wikibase:claim ?p ; wikibase:statementProperty ?ps .
    FILTER(?prop != wd:P2751)
    BIND(STRAFTER(STR(?prop), 'entity/') AS ?pid)
    ?st ?ps ?val . ?st wikibase:rank ?rank .
    FILTER(!CONTAINS(LCASE(STR(?val)), 'rcdb'))
    OPTIONAL { ?prop wikibase:statementValueNormalized ?psn . ?st ?psn ?nv . ?nv wikibase:quantityAmount ?amt ; wikibase:quantityUnit ?unit }
    OPTIONAL { ?prop wikibase:statementValue ?psv . ?st ?psv ?tv . ?tv wikibase:timePrecision ?prec }
    OPTIONAL { ?val rdfs:label ?valLabel FILTER(LANG(?valLabel)='en') }
    $REF }" > "$out/all.csv"
q "SELECT DISTINCT ?pid ?label ?type WHERE { $RC ?c ?p ?st . ?prop wikibase:claim ?p ; wikibase:propertyType ?type .
    BIND(STRAFTER(STR(?prop), 'entity/') AS ?pid) ?prop rdfs:label ?label FILTER(LANG(?label)='en') }" > "$out/props.csv"
q "SELECT ?c ?desc WHERE { $RC ?c schema:description ?desc FILTER(LANG(?desc)='en') }" > "$out/desc.csv"
wc -l "$out"/*.csv
