# CLAUDE.md

Working notes for Claude Code sessions on this repo. Short on purpose — the long
version, with every decision and why it went that way, is **`COASTERHUB_HANDOFF.md`**.
Read that before anything non-trivial, and add to it when a call gets made, so the
next session doesn't undo it.

Static site (HTML/CSS/vanilla JS) on Cloudflare Workers, D1 for data, R2 for avatars.
Live at coasterhub.org. **Push to `main` and it deploys** — no PRs, Carter's call.

## What this sandbox can and cannot reach

Reachable: GitHub, npm, usually the CDNs.

**Not reachable: coasterhub.org, Cloudflare (D1, R2, wrangler), Resend, map tile
servers.** The egress proxy denies CONNECT to all of them, and there are no
Cloudflare credentials in the environment. This has been re-tested several times
across sessions; it is the environment, not a transient failure.

So you cannot read or write the live database, deploy, send a real email, or load a
basemap tile. Don't offer to, and don't burn turns retrying. What you *can* do is
write the change, prove it locally, and hand Carter the one step that needs his
console.

## How a data change actually ships

1. **A migration file.** `migrations/NNN-name.sql`, with the reasoning in comments.
   Dry-run it first against `node:sqlite` using the repo's `coasters.json` and
   `<rider>.json` snapshots — they are real exports, so "670 → 672" is checkable
   before Carter touches anything. Then he pastes it into the D1 console. Every
   database change since 001 has gone this way.
2. **Or a browser-console `fetch`**, when the API already does what you want and
   Carter is signed in as admin. That path goes through the Worker, so it records
   activity and fires the repo-dispatch that re-syncs the static JSON. Raw SQL in
   the D1 console does neither — after SQL, the `<rider>.json` files sit stale until
   the Sync static JSON action is run by hand.

Write migrations so a second run is a no-op (`NOT EXISTS`, `IF NOT EXISTS`), and
match rows on something visible (name + park) rather than an id you read off a
snapshot. Never hand-edit a `<rider>.json` to fake a data change: D1 is the truth,
those files are the fallback, and the sync overwrites them.

## Verify before pushing — pushing is deploying

- `node tools/test-rides-api.mjs` — the real `worker.js` against `node:sqlite`.
- `node tools/check-inline-js.mjs` — parses every inline `<script>`.
- For anything visual: stand up the real-worker harness (serve the repo's files,
  route `/api/*` and `/avatars/*` through `worker.js`, fake D1 with `node:sqlite`)
  and drive it with `playwright-core` + `/opt/pw-browsers/chromium`. Look at the
  screenshot. Reasoning about CSS has been wrong more often than the screenshot has.
  When a CDN is blocked, vendor the library from `node_modules` and route the
  request to it rather than skipping the check.

## Traps that have each cost a deploy

- **CRLF files:** `README.md`, `index.html`, `stats.html`, `style.css`,
  `tools/import-credits.js`. Edit them in binary mode; a text-mode write flattens
  the line endings and the diff becomes the entire file.
- **Workers cap PBKDF2 at 100,000 iterations.** Node's WebCrypto does not, so a
  higher number passes every local test and 500s in production.
- **CSS shorthands reset their longhands** (`background` kills `background-image`
  and `background-size`, `font` kills `font-size`), and a more specific selector
  added later silently wins every property it repeats — `.profedit button.edit`
  over `.profedit .av`/`.nm`/`.un`/`.bioline`, and a second `select.userpick`
  rule over the first `.userpick` one, which erased the picker's chevron for
  weeks. Five bugs so far, all this one family. Grep for an existing rule before
  adding another for the same thing, and never use the shorthands. (That picker
  is gone as of 2026-09-17 — the rider switcher is the hero badge — but the
  lesson is not.)
- **`.hero p + p` outranks a bare class.** The follow line is a `<p>` after the
  bio's `<p>`, so that rule — one class, two elements — was silently deciding
  both its margins and everything `.followline{}` said about them was dead. The
  rules are `.hero .followline` now. Seventh instance: before adding a rule,
  check what *already* matches the element, not just what you are writing.
- **A CSS rule that names an element rather than what it means** breaks the day
  the element changes. `.herocount h1 span{display:block}` was what put one hero
  number per line; the numbers became links, and all three collapsed onto one
  line. Same family as the shorthands above — sixth instance.
- **An inline `padding` beats every stylesheet rule, media query included.** The
  heroes set `--hero-t`/`--hero-b` and let `style.css` do the padding, which is
  the only reason the phone layout can tighten it. Give a new page those, not a
  `padding`.
- **Nothing may set `.hero .badge`'s `textContent` on `/count`, `/rankings` or a
  profile.** That badge is a `<button>` built by `CoasterHub.riderBadge()` and
  writing text into it takes the chevron and the menu with it. `account.html`'s
  badge is a plain one and is fine.
- **Don't commit a `wrangler.jsonc` binding that isn't provisioned yet** — the
  automatic deploy fails on it.
- **Code that needs a migration must degrade to a 503 naming the file**, never a
  500, because there is always a window where the code is live and the migration
  isn't.
