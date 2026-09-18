# coasterhub
Coaster Hub website

## Running it locally

```sh
node tools/dev-server.mjs          # http://127.0.0.1:8100
node tools/dev-server.mjs --fresh  # ...from an empty database
```

The repo's own files, served the way Cloudflare serves them, with the real
`worker.js` behind `/api/*` and `node:sqlite` standing in for D1 — so auth,
rankings, the log and `/edit` behave as they do live. It seeds from
`coasters.json`, `parks.json` and each `<rider>.json`, which means 1,114 real
coasters and every real ride, not a toy fixture.

The database is `.dev.db` (gitignored) and survives restarts. `--fresh` wipes it.
Sign up at `/account`, then `/__admin` makes that account an admin and
`/__be?slug=carter` attaches it to a rider so you can edit their ranking. The
admin password for `/edit` is `letmein`.

Node 22+, nothing to install.
