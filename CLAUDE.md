# CLAUDE.md

Working notes for Claude Code sessions on this repo. Short on purpose — the long
version, with every decision and why it went that way, is **`COASTERHUB_HANDOFF.md`**.
Read that before anything non-trivial, and add to it when a call gets made, so the
next session doesn't undo it.

Static site (HTML/CSS/vanilla JS) on Cloudflare Workers, D1 for data, R2 for avatars.
Live at coasterhub.org. **Push to `main` and it deploys** — no PRs, Carter's call.
Carter, 2026-09-24: *"everything I say please push to main unless you need to clarify
anything"* — so ship each ask straight to `main` without asking first, even when the
session was started on a feature branch. And keep replies short: say what changed once,
and leave out the local test-harness narration (still run the checks; just don't report them).

## What this sandbox can and cannot reach

Reachable: GitHub, npm, usually the CDNs.

**Not reachable over the network: coasterhub.org, Cloudflare's own endpoints,
Resend, map tile servers, coaster-count.com.** The egress proxy denies CONNECT to
all of them, and so does the server-side fetcher WebFetch. Re-tested many times
across sessions; it is the environment, not a transient failure. So you cannot
call the site's API, deploy, send a real email or load a basemap tile — the API
path runs in Carter's browser, not here.

**But D1 is READABLE from 2026-09-20**, through the Cloudflare connector Carter
added (`mcp__Cloudflare_Developer_Platform__d1_database_query`, database
`coasterhub`, id `d4742d82-f606-498a-8520-bcbfec7dcf91`). Use it: checking the
live row beats guessing from a snapshot, and it is how the Chupacabra mess was
finally diagnosed. **Writes through it are refused by the harness**, so a change
still goes to Carter as a paste — which is the better path anyway, because SQL
skips the Worker (no activity row, no sync).

The GitHub connector can also start Actions, which matters for the next section.

## How a data change actually ships

1. **A migration file.** `migrations/NNN-name.sql`, with the reasoning in comments.
   Dry-run it first against `node:sqlite` using the repo's `coasters.json` and
   `<rider>.json` snapshots — they are real exports, so "670 → 672" is checkable
   before Carter touches anything. Then he pastes it into the D1 console. Every
   database change since 001 has gone this way.

   **The console's query box is one line, and a paste loses the newlines** — at
   which point the first `--` comment swallows the whole file and D1 answers
   *"The request is malformed: Requests without any query are not supported."*
   The file is fine; the paste is not. Hand him
   `node tools/paste-sql.mjs migrations/NNN-name.sql` output (comments stripped,
   one statement per line; `--one-line` joins them) rather than the file, and
   keep writing the reasoning into the file, where it belongs.
2. **Or a browser-console `fetch`**, when the API already does what you want and
   Carter is signed in as admin. That path goes through the Worker, so it records
   activity and fires the repo-dispatch that re-syncs the static JSON. Raw SQL in
   the D1 console does neither — after SQL, the `<rider>.json` files sit stale until
   the Sync static JSON action is run by hand.

### Pull the static JSON every now and then — it does not update itself

`coasters.json`, `parks.json` and each `<rider>.json` are the fallback the site
uses when D1 is unreachable, and they are what every local tool here matches
against. They are refreshed by the **Sync static JSON from D1** action, which is
supposed to run on its own: the Worker pings GitHub after each write
(`dispatchSync`). It never has. `dispatchSync` opens with
`if (!env.GITHUB_TOKEN) return;`, the secret is not set on the Worker, and every
run in the repo's history was started by hand. (Found 2026-09-20. The fix is one
command of Carter's: `npx wrangler secret put GITHUB_TOKEN` with a fine-grained
token for this repo, Contents: read and write.)

**So refresh them yourself when the answer depends on them** — before matching
somebody's list, before quoting a count, and at the start of a session that will
touch data. Carter's standing ask (2026-09-20: *"make a note ... to pull it every
now and then"*):

```
Actions -> "Sync static JSON from D1" -> Run workflow   (or the GitHub connector's
                                                         run_workflow)
git fetch origin main && git pull --ff-only origin main
```

It debounces two minutes, then commits only what actually changed. A sync run
that commits nothing means the snapshot was already current, which is also an
answer.

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

- **CRLF files:** `README.md`, `style.css`. Edit them
  in binary mode; a text-mode write flattens the line endings and the diff
  becomes the entire file. (Checked 2026-09-18: `index.html` is LF and has been
  for a while, and `stats.html` is gone — this list used to name both. Check with
  `git show HEAD:<file> | grep -c $'\r'` rather than trusting it.)
- **A phone photo is not the shape it looks.** It is a landscape bitmap plus an
  EXIF tag saying "rotate 90". Browsers apply that when DISPLAYING an `<img>`,
  so `naturalWidth/Height` and CSS backgrounds are upright — but
  `drawImage()`'s nine-argument source-rectangle form has a WebKit history of
  reading those coordinates in the RAW unrotated space, which crops a
  different region than the preview showed. `profile-edit.js` bakes every
  upload onto a canvas first (orientation applied once, in the plain
  three-argument draw) and measures that. This used to say no test here could
  see the bug, because a synthetic PNG carries no EXIF. **It can now:**
  `node tools/test-crop.mjs` (dev server + `playwright-core`) builds its own
  EXIF-tagged JPEG — an Orientation tag is 36 bytes in front of an ordinary
  file — whose every pixel encodes its own position, drives the real dialog,
  and reads the saved 256x256 back to prove it IS the region the preview
  showed. Run it if you touch the crop.
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
  line. Same family as the shorthands above — sixth instance. **Eighth
  instance, 2026-09-19:** `.rrow .mhead .tiny` styled the little buttons inside
  a category's header, so when "Pull all back in" was added to `.excl` — the
  same button, a few lines down — it rendered as a raw browser `<button>`, serif
  face and all. The rule is `.rrow .tiny` now. Scope to the thing, not the
  place it first appeared.
- **A bordered circle with `background-size:cover` has a rim, and the rim reads as
  a shift.** `cover` fills the padding box, so a 1px border ring sits OUTSIDE the
  picture showing the background-colour; against a light edge it is a dark line,
  against a dark edge it vanishes, and the eye reads that as the picture sitting
  low. Cost an evening of re-cropping a crop that was right (2026-09-21).
  `background-origin:border-box` on every avatar circle; keep it there.
- **An inline `padding` beats every stylesheet rule, media query included.** The
  heroes set `--hero-t`/`--hero-b` and let `style.css` do the padding, which is
  the only reason the phone layout can tighten it. Give a new page those, not a
  `padding`.
- **Nothing may set `.hero .badge`'s `textContent` on `/count`, `/rankings` or a
  profile.** That badge is a `<button>` built by `CoasterHub.riderBadge()` and
  writing text into it takes the chevron and the menu with it. `account.html`'s
  badge is a plain one and is fine.
- **`.hero` is `overflow:hidden`.** Anything that has to escape it — a dropdown,
  a popover — gets clipped at the hero's bottom edge, and the shorter phone hero
  hides less of the damage. The rider menu lives at the end of `<body>` and is
  positioned `fixed` for exactly this reason, the same lesson `profile-edit.js`
  records for the crop dialog. Do not nest the next one inside the hero.
- **No `cache-control` does NOT mean "do not cache".** With no max-age and no
  validator a browser falls back to *heuristic* freshness and may serve a
  cached copy without asking — which is how a profile came back wearing its
  owner's previous picture after they replaced it. Every JSON answer is
  `no-store` by default now (`JSON_HEADERS`); `/api/coasters` and `/api/parks`
  opt back in with an explicit short max-age. A new endpoint that returns live
  or per-user data needs nothing; one that wants caching must say so.
- **`html{scroll-behavior:smooth}` makes every programmatic scroll an ANIMATION.**
  `scrollBy`/`scrollTo` do not jump, and a new call replaces the running animation
  before it has travelled — so anything that scrolls in a loop (the drag-to-reorder
  edge scroll) crawls no matter how big the numbers are. It asked for 5,531px over
  two seconds and moved 70. Pass `behavior:'instant'` for any scroll the code
  drives itself. It also confounds tests: read `pageYOffset` right after a
  `scrollTo` and you get a value from the middle of the animation.
- **Don't commit a `wrangler.jsonc` binding that isn't provisioned yet** — the
  automatic deploy fails on it.
- **Code that needs a migration must degrade to a 503 naming the file**, never a
  500, because there is always a window where the code is live and the migration
  isn't.
