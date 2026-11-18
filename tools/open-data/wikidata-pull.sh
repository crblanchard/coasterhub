#!/usr/bin/env bash
# Pulls every roller coaster Wikidata knows (CC0) into tools/open-data/wikidata/*.csv.
# Three queries, kept apart so none times out:
#   base.csv   item, English label + aliases, country, coordinates, makers,
#              park candidates (part of / location / admin area), OSM ids
#   stats.csv  height / length / speed / duration, normalised to metres,
#              metres per second and seconds (psn:), with whether the
#              statement's own reference points at RCDB
#   dates.csv  opening and closing dates the same way
# Run from the repo root: bash tools/open-data/wikidata-pull.sh
set -euo pipefail
out=tools/open-data/wikidata; mkdir -p "$out"
q(){ curl -sS -m 300 -G "https://query.wikidata.org/sparql" -H "Accept: text/csv" \
      -H "User-Agent: coaster-open-dataset/0.1 (open data build)" --data-urlencode "query=$1"; }
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
wc -l "$out"/*.csv
