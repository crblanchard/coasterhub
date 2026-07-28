# Coaster Hub — Session Handoff

_Last updated 2026-07-28 by a Claude Code session._

This file is tracked in git on purpose so it syncs between machines. Commit your updates to it.

---

## Project at a glance

- **What it is:** static site (HTML/CSS/vanilla JS) visualising roller-coaster counts for
  several riders. Live at **coasterhub.org** (also `coasterhub.carter-r-blanchard.workers.dev`).
- **Backend:** Cloudflare **D1** (`coasterhub`, id `d4742d82-f606-498a-8520-bcbfec7dcf91`) is
  the source of truth — tables `coasters` / `parks` / `rides` (Carter) / `credits` (Cole,
  Keltan, Max) / `users`. `worker.js` serves the API; `app.js` reads it with a **static-JSON
  fallback**, so the `.json` files in the repo stay as seed + safety net. If D1 is unbound
  every `/api/*` returns 503 and the site still works.
- **Deploy:** push to `main` → Cloudflare Workers Builds deploys automatically.

### How we work — commit straight to `main`, no pull requests

Carter's call (2026-07-28): **don't open PRs, just commit and push to `main`.** One
person owns this repo, every change deploys on merge anyway, and a PR per tweak was
mostly clutter on the backend. So:

```bash
git add -A && git commit -m "..." && git push origin main
```

What replaces the PR as the safety net — do these *before* pushing, because nothing
downstream will catch a mistake now:

- `node --check` any JS you touched, and `node tools/test-rides-api.mjs` if you went
  near `worker.js`.
- Actually render the affected pages and look at them. `playwright-core` + the
  pre-installed Chromium works in a sandbox: serve the repo as static files and the
  `/api/*` calls 404 and fall back to the static JSON, which exercises that path too.
  **Always check a phone width** — most bugs in this project have been mobile-only
  (unstyled pages from relative asset paths, header overflow, iOS overscroll).
- Write a real commit message. With no PR description, the commit *is* the record of
  why a change happened.
- Keep each commit self-contained, since it lands on production directly. To undo:
  `git revert <sha> && git push origin main`.

### Current data (2026-07-28)

| | |
|---|---|
| coasters | **1,143** |
| parks | **240** |
| carter | 2,362 rides / 562 credits |
| cole | 546 credits |
| keltan | 795 credits |
| max | 418 credits |

### Key files

| file | role |
|---|---|
| `index.html` | home — combined unique credits + a card per rider, driven by `USERS` |
| `stats.html` | per-rider dashboard (KPIs, on-this-day, records, milestones, map, charts) |
| `coasters.html` | filterable coaster table. Default sort: park, then name |
| `rides.html` | ride log — by-day cards or a flat sortable table |
| `log.html` | gated park-day logger (`noindex`, not in nav — type `/log`) |
| `edit.html` | gated admin editor (coasters + parks, merge, geocode) |
| `database.html` | unlisted QC page, not in nav |
| `app.js` | data engine (`computeStats`) + nav (`initNav`, `USERS`, `userPageHref`) |
| `worker.js` | Worker entrypoint — static assets + JSON API |
| `tools/sync-static.mjs` | regenerate the static JSON from the live API |
| `tools/test-rides-api.mjs` | **31 endpoint tests** over `node:sqlite` (no network) |

### Rider data shapes

```
{user, credits:[{c:id}, ...]}                       // collection only
{user, credits:[{c:id, n:12}, ...]}                 // + ride counts
{user, credits:[{c:id, first:"YYYY-MM-DD"}, ...]}   // + first-ridden dates
{user, credits:[{c:id, num:200}, ...]}              // + credit numbers (milestones)
{user, rides:[{c:id, d:"YYYY-MM-DD"}, ...]}         // full dated log (unlocks everything)
```

`computeStats` detects four **independent** capabilities and only renders panels the data
supports: `firstDates` (timeline), `rideCounts`, `activity` (calendar, biggest days), `order`
(credit numbers → milestones). Adding a rider = drop `<name>.json` in the repo root + add
`{slug, name}` to `USERS` in `app.js`; home cards, the combined total and the dropdown follow.

---

## Architecture decisions worth knowing

### Location lives on the **park**, never on the coaster

`coasters.loc` was dropped from D1 and from `coasters.json` entirely. Every page derives a
coaster's location from `parks[coaster.park].region`. This was done because the two copies
drifted (coasters reading `"US"` while their park said `"Ohio, US"`).

Park regions are normalised: US parks are `"<State>, US"`, everything else is a country name.
Set a park's region once in the `/edit` Parks tab and every page follows.

### Static JSON auto-syncs after an edit

`worker.js` fires a GitHub `repository_dispatch` (`event_type: "edit"`) after **every**
successful D1 write — fire-and-forget via `ctx.waitUntil`, so it never slows an edit down.
`.github/workflows/sync-static.yml` catches it, waits **2 minutes** for edits to settle
(`concurrency: cancel-in-progress`, so a burst collapses into one run), runs
`tools/sync-static.mjs`, and commits the refreshed JSON to `main` **only if it changed**.
One editing session = one commit = one deploy.

Requires a **`GITHUB_TOKEN`** Worker secret (fine-grained PAT, Contents: read+write). It is
configured. Without it the dispatch is a silent no-op and nothing else breaks.

### Asset paths must stay absolute

`/user/<slug>/…` URLs are **200 rewrites**, so the browser keeps the pretty path. A relative
`href="style.css"` there resolves to `/user/<slug>/style.css` → 404 → **completely unstyled
page**. All asset refs are root-absolute (`/style.css`, `/app.js`, `/mark.svg`), and
`stats/coasters/rides/log/database` also carry `<base href="/">`. `index.html` deliberately has
**no** `<base>` — it would break its in-page `#riders` anchor.

---

## The ride log (added 2026-07-28)

### `/rides` — public, per-rider, in the main nav

Reads `GET /api/rides/<slug>` with the usual static fallback. Two views:

- **By day** (default, dated riders only) — one expandable card per date: parks visited, ride
  count, coaster count; expanding lists each coaster with a `×N` lap count. 30 days/page.
- **All rides** — flat sortable table (Date / Coaster / Park / Location). 60 rows/page.

Search + year + park filters apply to both. Four tiles (rides · coasters · parks · days out)
recount live against the current filter.

Riders without a dated ride log still render: **Cole** and **Keltan** (first-ridden dates only)
get a "credit log" framing — each coaster once, on the day they first rode it; **Max** (credit
numbers, no dates) gets the flat table with a Credit # column. The page forces the flat view
for those riders and hides the By-day toggle.

### `/log` — password-gated park-day logger

Pick rider + date + park, step lap counts up/down per coaster, save the whole day as one batch.

- Gate reuses the **exact** `/edit` pattern — `POST /api/admin/login` with an `x-admin-token`
  header, password cached in `sessionStorage` under `ch_admin`, so unlocking `/edit` unlocks
  this too.
- Date defaults to **today in local time** (built from `getTimezoneOffset()`, not
  `toISOString()` on the raw date — that logs yesterday for Carter's timezone after 5pm PT).
- Park dropdown lists every park with its coaster count. Leave the park blank and type 2+
  characters to search all coasters instead.
- Right-hand basket shows what's staged with running totals; Save posts once and reports the
  new grand total.

### Worker API

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/rides/:slug` | public | `rides`-mode riders get one entry per ride **including the row id** (`i`) so a single ride is deletable. `credits`-mode riders are projected into the same shape (`d` = first-ridden, plus `num`/`n`) so one page renders everyone. |
| POST | `/api/rides` | **gated** | `{user, d:"YYYY-MM-DD", entries:[{c,n}]}`. Validates **every** coaster id up front and 400s the whole batch if any is unknown — a typo can't half-log a day. Laps clamp to 1–50. Chunks the D1 batch at 90 statements. Returns `{added, coasters, total, date}`. |
| DELETE | `/api/ride` | **gated** | `{i:<row id>}` — undo a mis-tapped ride (dated logs only). |

For a `credits`-mode rider, POST **upserts**: earliest date wins, lap counts accumulate, and an
existing `num` (credit number) is preserved — so Max's milestones survive a logged day.

### Tests

```bash
node tools/test-rides-api.mjs        # 31 tests, all passing
```

Runs the real `worker.js` router against `node:sqlite` standing in for D1 — no network, no
wrangler, no `npm install`. Covers auth, validation (a bad batch must write **nothing**), both
write paths, lap clamping, the credits upsert rules, delete, and a regression pass over
`/api/coasters`, `/api/parks` and `/api/user/:slug`.

---

## Open tasks

### 1. Full editing of past days in `/log` — **requested, not built**

`/log` currently supports **add a day** + **undo an individual ride** (`DELETE /api/ride`).
Carter asked for full editing as a follow-up: pick any past date, load that day, adjust or
remove lap counts, change the date, re-save. Notes for whoever picks it up:

- Needs a `GET` that returns one day for one rider (or filter client-side from `/api/rides/:slug`).
- Changing a **date** should `UPDATE` rows rather than delete+insert, or ride row ids churn.
- `credits`-mode riders have no per-ride rows, so "editing a day" can only adjust `n` and
  `first` — decide whether to expose that at all, or keep full editing to dated riders.

### 2. Milestones for everyone

The milestones panel needs an explicit credit number (`num`), so only **Max** has it. The
others could derive ordering from first-ridden dates:

| rider | credits | dated | derivable? |
|---|---|---|---|
| carter | 562 | 562 (100%) | yes — exact |
| keltan | 795 | 597 (75%) | yes, but 198 undated credits have no place in the order |
| cole | 546 | 303 (55%) | same caveat, worse |
| max | 418 | 0 | already works via `num` |

Work: in `computeStats`, when `hasOrder` is false but first-ridden dates exist, sort by
`[date, coaster id]` (stable secondary key, or "your 500th" flips between loads) and set
`has.order`. **Decide first:** for a partially-dated rider, does the Nth milestone count only
dated credits, or do undated ones get appended? Consider labelling derived milestones
differently ("your 500th dated credit"). Carter hasn't answered this.

### 3. Accounts / self-serve riders — wanted, deliberately deferred

Carter wants people to be able to sign up and track their own count rather than a
rider being added by hand. Not started; the home hero already says "keep track of
**your** count", which everyone currently viewing the site knows is the direction
rather than a description of today.

What makes this bigger than it looks:

- **Auth doesn't exist yet.** There is one shared `ADMIN_PASSWORD` gating every
  write. Accounts means per-user identity — either a sessions table with hashed
  passwords in D1, or Cloudflare Access / an OAuth provider in front.
- **The `users` table is already shaped for it** (`slug, name, mode, email,
  created`) — `email` is present and unused, so the schema barely has to move.
- **`USERS` in `app.js` is hardcoded**, and every page reads it for the nav,
  the picker, home cards and the combined totals. It would need to come from the
  API instead.
- **The static-JSON fallback assumes a fixed set of riders.** `tools/sync-static.mjs`
  writes one `<slug>.json` per rider from a hardcoded `SLUGS` list; that model
  doesn't survive arbitrary signups. Either generate from the live user list or
  accept that the offline fallback only covers the original riders.
- **Write authorisation becomes per-row**: today any unlocked session can log a day
  for anyone. With accounts, a rider should only be able to edit their own count
  (with an admin override).

### 4. Smaller items

- **117 coasters have no `type`** (Steel/Wood), which skews the steel/wood split. `/database`
  has an "Only incomplete" filter; `tools/import-captaincoaster.js` can backfill details.
- ~~**The `"?????"` park**~~ — **resolved.** Coaster #793 "Spinning Coaster (The Track 3 SBF)"
  was Max's credit (an earlier version of this file said Keltan's — wrong). It's the Spinning
  Coaster at **Track Family Fun Parks**, Branson, MO (`rcdb.com/19966.htm`); the coaster's own
  name gave it away. Renamed, given `Missouri, US` + coords, and the `?????` park deleted.
  Its `h`/`l`/`inv` were filled from the SBF Visa Spinner model spec the other eight spinners
  in the table already carry, **not** from RCDB — rcdb.com returns 403 to this environment, so
  those three numbers are model-inferred and unverified against the listing.
- **The Incredible Pizza spinners are a mess worth watching.** Two merges have already happened:
  #1140 → **#822** (duplicate rows for the same Tulsa ride, now "Spinning Coaster"), and
  #262 → **#679** (Carter's credit was filed under a Springfield park but the ride was actually
  St. Louis; the now-orphaned `Incredible Pizza Company` park was deleted). #679 lost the
  manufacturer/model/year/height/length that #262 carried, because those had been imported
  against the *Springfield* listing and don't necessarily describe the St. Louis ride — only
  `type=Steel` was kept. **#679 and #822 both still need specs.** Note the chain uses two naming
  styles, `<City>'s Incredible Pizza Company` and `John's Incredible Pizza Company <City>`; keep
  the city in the name so locations can't be confused again.
- **Carter's total is 2,362, not 2,400.** Might be rounding, might be ~38 rides he knows are
  missing. `/log` is the tool for filling them in.
- **Traveling shows.** Butler Amusements, Ray Cammack Shows, Davis Amusement Cascadia, Helm &
  Sons, Pouzet Group are operators, not fixed parks — no coordinates, so they're skipped on the
  map. Considered an explicit `traveling` flag on the park so the UI can label them rather than
  them looking like missing data; deferred.
- **`Boomers` vs `Boomers!`** are two different real parks (Fountain Valley and El Cajon, CA).
  Left as-is; renaming them to include the city would be clearer.

---

## Gotchas that will bite you

1. **Line endings are mixed — match the file you're editing.** `index.html` and `stats.html`
   are **CRLF**; `coasters.html`, `rides.html`, `rankings.html`, `log.html`, `edit.html`,
   `database.html`, `app.js`, `worker.js` and the JSON files are **LF**. Getting it wrong produces a whole-file
   whitespace diff.

2. **JSON files are compact, one line, no trailing newline.** That's what
   `tools/sync-static.mjs` writes; match it or every sync produces a spurious diff.

3. **Worker entry file must stay `worker.js`.** Workers Builds runs `npx wrangler deploy` and
   wrangler rejects `_worker.js` as an asset. `worker.js`, `wrangler.jsonc` and `.assetsignore`
   are all listed in `.assetsignore`.

4. **`worker.js` uses `export default` but the repo has no `"type":"module"`.** The test harness
   copies it to a `.mjs` name to import it. Don't "fix" this by adding a `package.json` type
   field — wrangler is happy as-is and changing it risks the deploy.

5. **Caching: `_headers` cannot expire a copy the browser already has.** `style.css`, `app.js`
   and the JSON files have no hash in their filenames. `_headers` now sends
   `Cache-Control: no-cache` for `/*` (images get a week), so anything fetched from here on
   revalidates — but that only governs *future* fetches. A browser that cached a file before
   those rules existed keeps serving its old copy regardless. This cost real debugging time:
   iOS Safari held a `style.css` from before the bottom tab bar shipped, so `.tabbar` fell back
   to its default `display:none`-less flow position, rendering as a block of links after the
   footer with a page's worth of empty space below. It read as a scroll bug and several CSS
   "fixes" were pushed into a file the phone never re-downloaded. Incognito was always fine —
   **that's the diagnostic.** If a change appears not to take effect on one device but works in
   a private tab, it's cache, not code. The only way out is to change the URL: bump the `?v=`
   string on the `style.css` / `app.js` tags (currently `20260728a`) across all seven HTML
   pages. With `no-cache` in place this shouldn't be needed again.

6. **Merging coasters is safe, but verify.** The pattern used throughout this project:
   `UPDATE OR IGNORE credits SET coaster_id=<to> WHERE coaster_id=<from>`, same for `rides`,
   then delete the loser **guarded** by `AND id NOT IN (SELECT coaster_id FROM credits UNION
   SELECT coaster_id FROM rides)`. Afterwards confirm every rider's credit count is unchanged.
