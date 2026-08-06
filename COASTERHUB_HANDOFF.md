# Coaster Hub — Session Handoff

_Last updated 2026-08-05 by a Claude Code session._

This file is tracked in git on purpose so it syncs between machines. Commit your updates to it.

---

## Project at a glance

- **What it is:** static site (HTML/CSS/vanilla JS) visualising roller-coaster counts for
  several riders. Live at **coasterhub.org** (also `coasterhub.carter-r-blanchard.workers.dev`).
- **Backend:** Cloudflare **D1** (`coasterhub`, id `d4742d82-f606-498a-8520-bcbfec7dcf91`) is
  the source of truth — tables `coasters` / `parks` / `rides` (**everyone**) / `users` /
  `rankings`. `worker.js` serves the API; `app.js` reads it with a **static-JSON fallback**,
  so the `.json` files in the repo stay as seed + safety net. If D1 is unbound every
  `/api/*` returns 503 and the site still works.
- **`credits` still exists but nothing reads it.** It is the backup from the 2026-07-29
  migration (see below). Dropping it is step 3 of `migrations/001-credits-to-rides.sql`,
  left commented out on purpose.
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

- `node --check` any JS you touched, `node tools/check-inline-js.mjs` **always**, and
  `node tools/test-rides-api.mjs` if you went near `worker.js`. The inline check exists
  because a dropped `+` in a string concatenation once killed the whole script on
  `/log` and `/add` — no tab bar, no footer year, and Unlock silently did nothing.
  `node --check` does not look inside HTML.
- Actually render the affected pages and look at them. `playwright-core` + the
  pre-installed Chromium works in a sandbox: serve the repo as static files and the
  `/api/*` calls 404 and fall back to the static JSON, which exercises that path too.
  **Always check a phone width** — most bugs in this project have been mobile-only
  (unstyled pages from relative asset paths, header overflow, iOS overscroll).
- Write a real commit message. With no PR description, the commit *is* the record of
  why a change happened.
- Keep each commit self-contained, since it lands on production directly. To undo:
  `git revert <sha> && git push origin main`.

### Carter's Europe 2025 + Japan 2026 trips were copied to the others (2026-08-05)

Carter's rides from **Europe 2025** (2025-04-11 → 04-19, 98 rides / 66 coasters) and **Japan
2026** (2026-03-07 → 03-16, 64 rides / 46 coasters) were copied to the riders who were there,
written **straight to D1** rather than through the API (there is no bulk endpoint). The rule
was: **credits must not change** — only ride totals — so each rider only received rides for
coasters they already held.

| rider | what they got | rows | credits |
|---|---|---|---|
| cole | already had every coaster dated on the right days; only the **50 re-rides** were missing | 546 → 596 | 546, unchanged |
| max | Japan only, replacing his undated placeholders | 424 → 442 | 424, unchanged |
| sean | both trips, replacing his undated placeholders | 670 → 721 | 669 → **670** |

Two decisions worth keeping:

- **Max was not on the Europe trip.** He held *none* of its 66 coasters, so copying would have
  added 66 credits. Skipped — Carter confirmed.
- **An undated row is a placeholder, so it was replaced, not added to.** "I rode this, date
  unknown" plus the dated rides for the same coaster would count the ride twice. The inserts
  top up to Carter's exact per-coaster-per-day counts, so nobody exceeds his numbers.
- **Sean was missing three:** Supersplash (Plopsaland) and Free Fall (Nagashima) stayed off his
  list, Roller Coaster (Hanayashiki) was added on Carter's say-so (that is his +1 credit). The
  two left out are recorded in `RIDER_NOTES` in `stats.html`, which prints a standing note near
  the top of his page. **Delete that entry if they're ever added.**

Direct SQL bypasses `recordActivity` and the `repository_dispatch` that refreshes the static
JSON, so activity rows were inserted by hand and the sync workflow was run manually
(Actions → *Sync static JSON from D1* → Run workflow). Remember both if you ever write to D1
directly again.

### Current data (2026-08-05)

Every rider lives in `rides`. "Undated" rows are credits with no known date — they
count toward credits, and are excluded from anything calendar-shaped.

| rider | rows | credits | Σ distinct id | undated |
|---|---|---|---|---|
| carter | 2,362 | 562 | 159439 | 0 |
| cole | 596 | 546 | 193652 | 243 |
| keltan | 795 | 795 | 448521 | 198 |
| max | 442 | 424 | 193116 | 378 |
| sean | 721 | 670 | 295201 | 559 |

coasters **1,114** · parks **247**

Checked against D1 on all three columns after the trip copy above; the static JSON in the
repo matches. **Sean and Max have dated rides for the first time** (their trip days), so their
pages now show timelines and day views for that slice — the capability flags turning on, not
new data appearing from nowhere. 63 of Sean's 668 original sheet rows are still not imported;
see the open task below.

The Σ column is a checksum. **Verify migrations on counts _and_ `SUM(DISTINCT coaster_id)`** —
counts alone hide a swapped pair, which is how a bad merge nearly went unnoticed.

### Key files

| file | role |
|---|---|
| `index.html` | home — combined unique credits + a card per rider, driven by `USERS` |
| `stats.html` | per-rider dashboard (KPIs, on-this-day, records, milestones, map, charts) |
| `rides.html` | the count, three ways: by-day cards, a flat ride table, or **Full list** (every coaster once, filterable). The last one was `coasters.html` until it was folded in here — see below |
| `add.html` | gated page for adding **parks and coasters to the shared database**, with duplicate detection. Desktop header + footer only — not in the mobile tab bar |
| `log.html` | gated logger, two modes (a dated park day, or a list ticked off). Last item in the mobile tab bar |
| `migrations/` | one-off SQL, not served (see `.assetsignore`) |
| `edit.html` | gated admin editor (coasters + parks, merge, geocode) |
| `database.html` | unlisted QC page, not in nav |
| `app.js` | data engine (`computeStats`) + nav (`initNav`, `USERS`, `userPageHref`) |
| `worker.js` | Worker entrypoint — static assets + JSON API |
| `tools/sync-static.mjs` | regenerate the static JSON from the live API |
| `tools/test-rides-api.mjs` | **112 endpoint tests** over `node:sqlite` (no network) |
| `tools/dev-server.mjs` | local stand-in for the Worker — serves the repo, mirrors `_redirects`, stubs the API so `/log`, `/add`, `/edit` can be driven in a browser. Password `letmein` |
| `tools/check-inline-js.mjs` | parses every page's inline `<script>`. **Run it before pushing** |
| `tools/build-aliases.mjs` | one-off: reconstructed the former-name table from git history |

### Rider data shape — one shape, since 2026-07-29

```
{user, rides:[{c:id, d:"YYYY-MM-DD"}, ...]}   // d absent/null = date not known
```

That is it. There used to be two storage modes — Carter one-row-per-lap in `rides`, everyone
else one-row-per-coaster in `credits` — and every read path branched on `users.mode`. They
could not be reconciled: a credits-mode rider logging a park day had the day silently
flattened away, and a rides-mode rider had nowhere to put a coaster they could not date.
That is what made a single add page impossible, so it went first.

Now **a credit is `COUNT(DISTINCT coaster_id)`** and **first-ridden is `MIN(d)`**. `rides.d`
was already nullable, so no schema change was needed. `users.mode` is still a column but is
`'rides'` for everyone and nothing branches on it.

`computeStats` derives three **independent** capabilities rather than storing them, and only
renders panels the data supports:

| flag | test | unlocks |
|---|---|---|
| `firstDates` | any row has a date | timeline (cumulative, new-per-year) |
| `rideCounts` | **rows > distinct coasters** — a re-ride exists | total rides, most-ridden, re-ride distance |
| `activity` | both of the above | calendar heatmap, rides/year, biggest days |

**`rideCounts` is deliberately not "has any rows".** A list ticked off leaves exactly one row
per coaster, which says nothing about how many times they were ridden — reading that as "rode
it once" would have Cole's page announce 546 rides he never claimed. Each flag flips on by
itself as a rider logs more; there is nothing to set and no migration to run.

Adding a rider (since 2026-08-05) = the **+ Person** button on `/import` or the **+** beside
the rider picker on `/log`, which `POST`s `/api/user`. Every picker, the home cards and the
combined total follow from `GET /api/users` — no `<name>.json` and no `USERS` edit needed.
Their `<slug>.json` appears on the next static sync. See "Riders come from D1" below.

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
`stats/rides/rankings/add/log/database` also carry `<base href="/">`. `index.html` deliberately has
**no** `<base>` — it would break its in-page `#riders` anchor.

### The mark is one path, and the numbers are load-bearing (2026-08-05)

The track in `mark.svg` is a **single continuous stroke** — lift hill, drop, under the loop,
around it, and out. It used to be three pieces: two teal fragments with a coral circle butted
against their ends, which read as a sticker parked next to a hill rather than part of the ride.
Two things carry the fix, and neither is decoration:

- **Entry and exit meet the loop on its tangent**, 45° either side of the bottom — `(50.22,
  32.72)` and `(36.78,32.72)` on a circle centred `(43.5,26)` with `r=9.5`. That is why there is
  no corner where they join.
- **The legs cross below the loop**, at about `(43.6,40.7)`. That crossing is what says
  "track". Remove it and the shape is a balloon.

Change one of those and you have to change all of them. The coral is now only the car — a
colour break mid-track was half of why the loop looked detached.

Four SVGs carry the same path and must stay in step: `mark.svg` (header), `favicon.svg` (tile,
no vertical supports), `favicon-small.svg` (16px: no ground line, no supports, no riders' heads,
fatter stroke), and `logo.svg` (mark + wordmark).

**Regenerating the rasters:** `favicon-16/32.png` and `apple-touch-icon.png` are rendered from
that geometry in headless Chromium (see the render script in a scratchpad, or rebuild it — it is
30 lines). `og-image.png` is **composited, not re-rendered**: only the 201×201 tile at `(500,92)`
(fill `#061121`, corner radius 45) is redrawn, because the wordmark and tagline in that file were
set in a font this container does not have and re-rendering the whole card would change the type.
`logo.png` is stale and unused by any page; nothing links it.

---

## The ride log (added 2026-07-28)

### `/rides` — public, per-rider, in the main nav

Reads `GET /api/rides/<slug>` with the usual static fallback. **Three** views:

- **By day** (default, dated riders only) — one expandable card per date: parks visited, ride
  count, coaster count; expanding lists each coaster with a `×N` lap count. 30 days/page.
- **All rides** — flat sortable table (Date / Coaster / Park / Location). 60 rows/page.
- **Full list** — every coaster in the count, once each, with manufacturer/model/height/speed/
  status and its own filters. This *was* the separate `/coasters` page.

Search + year + park filters apply to the first two. Four tiles (rides · coasters · parks ·
days out) recount live against the current filter.

Riders without a dated ride log still render: **Cole** and **Keltan** (first-ridden dates only)
get a "credit log" framing — each coaster once, on the day they first rode it; **Max** (credit
numbers, no dates) gets the flat table with a Credit # column. For those riders only the
**By day** button is hidden — not the whole switch, since Full list still applies.

#### Why `/coasters` was folded in here (2026-07-28)

For three of the four riders `/coasters` and `/rides` were showing the same set of coasters —
Cole, Keltan and Max have **zero** rides, so `/rides` was re-listing their credits in a
different order while `/coasters` listed the same credits in a table. Two nav slots, one
dataset. Carter's call: merge them, keep the name **Rides**, because more people logging
day-by-day is the direction this is going.

Mechanics worth knowing before touching it:

- The two views collide on **eleven element ids** (`q`, `head`, `body`, `count`, `reset`,
  `ui`, `err`, `loading`, `f_park`, `people`, `y`). The full-list markup therefore uses
  `c_`-prefixed ids, and its logic lives in the `CreditList` closure at the bottom of the
  file, which exposes only `open()`. Don't hoist anything out of it.
- `CreditList` loads **lazily** on first open, so the log isn't slowed by fetching the
  coaster table nobody may look at.
- `setView('list')` hides the log's own filters and has to hide `#dayview`/`#allview` itself,
  because `render()` — which normally does that — doesn't run for this view.
- `?view=list` opens straight on it. `/coasters` and `/user/:name/coasters` **301** there, and
  the "Full credit list" link in the Stats hero points at it.

### `/log` — password-gated, **two modes** (2026-07-29)

Last item in the mobile tab bar. One park picker, two ways to add:

| | **Coaster rides** | **Coaster credits** |
|---|---|---|
| date | shown, required | hidden, posts `d: null` |
| control | `±` stepper, every lap counts | one tick, whole row tappable |
| basket | `×3` lap counts | names only, "no dates" |
| button | Save day | Add to my count |

The only real difference is whether a date is attached; a toggle beats an optional date field
because the *controls* differ, not just the field. **Switching modes clears the basket** —
laps mean nothing in list mode and a tick means nothing in day mode.

List mode loads the rider's existing count and marks it: already-held coasters are shown but
inert (hiding them reads as missing data), and the ones you can still tick **sort to the
top**. Cedar Point reads "23 · 20 in your count" for Cole. Without this you are re-ticking
your own history blind.

Undated writes are guarded server-side: an entry is inserted only if the rider has **no** row
for that coaster, dated or not. Ticking something you already have adds nothing rather than
inventing a ride. A lap count on an undated entry still writes one row, because laps are
unknown. `d: null` is explicit — a *malformed* date is still a 400.

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
- **Adding a park** — the `+ Park` button beside the dropdown opens an inline form (name +
  region) and `PUT /api/park`. The new park is selected straight away and appears with `(0)`.
  It has no coordinates, so it is skipped on the map until someone runs the geocoder in
  `/edit`.
- **Adding a coaster** — `+ Coaster not listed` appears once a park is chosen (not while
  searching, since a new coaster needs a park to belong to). Name + Steel/Wood, then
  `POST /api/coaster`. The new coaster is **staged at one ride automatically**, because you
  are only adding it if you just rode it. Everything else — height, speed, year, maker — is
  left null for `/edit` later. A same-name coaster in the same park is refused client-side.
- **Both adds ask for confirmation first.** The write is immediate and there is no undo from
  `/log` — removing a bad row means `/edit`, or D1 directly. A test row got into the live
  table within minutes of shipping this, which is why the confirm exists.

### `/add` — the shared database, not your count (2026-07-29)

Same password as `/log` and `/edit` (`sessionStorage.ch_admin` — unlocking one unlocks all).
A locked visitor gets an explanation rather than a dead form, because `/add` is linked from
the public nav. Two forms: new coaster (name + park required, every spec optional) and new
park. The inline `+ Park` / `+ Coaster not listed` buttons **stay in `/log`** — the moment you
find something missing is mid-basket at a park, and bouncing to another page would drop it.

**The duplicate check is why this page exists** rather than being two more boxes on `/log`.
~50 duplicates have been merged by hand here. Two normalisations, because duplicates arrive
in two shapes:

- `norm` — lowercase, strip apostrophes (**every** lookalike: `'` `’` `ʼ` `` ` `` `´`), drop a
  leading "the"/"a", collapse punctuation. Catches `The Underground` → `Underground`,
  `Rollies Coaster` → `Rollie's Coaster`.
- `squash` — the above with **spaces removed**. The only way `SandSerpent` matches
  `Sand Serpent`.

**Picking a park also lists what's already there** (2026-08-05) — every coaster at that park as
a chip with type and year, right under the picker, before a name has been typed. The warnings
below only fire once a typed name looks like something already listed, which is too late for
the commonest case: not knowing the ride is there under a name you didn't think of. Anything
close to what is being typed is highlighted and floats to the front of the list.

Same park + exact match after normalising **blocks** the save and points at renaming the
existing row in `/edit` — renaming keeps everyone's rides attached, a second row strands them.
One name containing the other only warns. Same name at a **different** park just informs:
there are legitimately eight Boomerangs, and the useful reading is "check your park picker".

#### Anyone with the password can add — this is deliberate, and temporary

Carter's call (2026-07-29): let people add parks and coasters directly for now, because the
friction of asking him for every kiddie coaster is worse than the odd bad row. **The
eventual model is request-then-approve**: a rider proposes a park or coaster, it lands in a
pending state, and Carter approves before it joins the shared list.

Nothing in the schema supports that yet. When it is built it needs, roughly: a `pending`
flag (or a separate `proposals` table) on `coasters`/`parks`, an approval view, and the
public pages filtered to approved rows only. Worth doing at the same time as accounts —
"who proposed this" needs a real user identity, which the single shared password cannot
provide.

### `/import` — a whole list at once, and **nothing is skipped** (2026-08-05)

Password-gated, linked from `/log`. Paste a list or drop a `.xlsx`/`.csv`/`.tsv`/`.txt`; it
resolves each line and shows buckets to look over before anything is written.

**The rule this page is built around: a line that doesn't match is work to do, not a line to
drop.** Everything unresolved lands in the **Needs a hand** bucket, where each row carries a
park box (backed by one shared `<datalist>` of every park) and a ride dropdown, and is only
imported once both are set. The old "no park → skip those lines" default is gone; the setting
now defaults to **sort them out below**, with skipping as a deliberate choice.

How a row gets its guess:

- Park resolved, ride not found → the ride dropdown lists that park's coasters, plus an
  **Elsewhere** group for the same name at other parks (picking one moves the row's park —
  that's how a wrong or renamed heading gets corrected).
- No usable park → candidates come from `findAnywhere()`, which searches every coaster.
  **Only an exact name match that is unique in the whole database is taken automatically.**
  Substring and typo passes only ever populate the dropdown: "Batman: The Ride" is at nine
  parks, and a loose substring once auto-matched "Zzzz Nonexistent Coaster" to "Coaster" at
  Playland. The substring pass also requires the two names to be within 60% of each other's
  length for the same reason.
- Naming the park on one row **applies it to every other unfinished row under the same
  heading**, so a forty-line block costs one park lookup, not forty.
- A ride the rider already holds resolves but does **not** tick — it moves to *Already in the
  count* on the next check rather than promising a credit that never appears.

`FIXES` memoises every hand-picked ride against its source line, so re-checking the list,
saving, or hitting **reload** (after adding something on `/add` in another tab) never makes
anyone redo that work. The count next to the save button always says how many lines are still
unmatched, and the save confirm repeats it.

**Parsing changes that came with this**, both about not putting rides in the wrong place:

- A line opening a block that matches nothing — not a coaster at the park above, not a coaster
  anywhere — is carried as an **unknown park heading** rather than as a coaster. Previously
  everything under a park we don't have was silently credited to the park above it.
- The "first row is column titles" rule now requires **every** cell to be a header word
  (`park`, `coaster`, `name`, `date`, …). It used to drop any first line *containing* the word
  "park", which ate exactly the unknown-park headings above.

### Riders come from D1, not only from `USERS` (2026-08-05)

`GET /api/users` serves the rider list and `POST /api/user` (gated) adds one, so a new person
can be added from the **+ Person** button on `/import` or the **+** beside the rider picker on
`/log` and be logged for immediately — no deploy. The slug is derived from the name
(accent-folded, URL-safe), page names are refused, and a clash 409s.

`USERS` in `app.js` is now the **seed and the offline fallback**. `CoasterHub.fetchUsers()`
merges the API's list into it in place and caches it in `localStorage` under `ch_users`; the
cache is read synchronously at load because home/stats/rides read `USERS` while booting, so
without it a new rider would be missing from the page that fetched them. The cache stores the
API's list verbatim, so a rider removed from D1 stops being merged on the next load. Those
pages now also tolerate a rider whose `<slug>.json` doesn't exist yet (`fetchUser` falls back
to the API, and a failed read becomes an empty log instead of an exception), and
`tools/sync-static.mjs` takes its slug list from `/api/users` so new riders get static files.

A new rider's own pages work immediately — `/api/user/:slug` returns an empty ride log rather
than a 404 — they just show nothing until something is logged.

### `/changes` — the activity feed, and two things that bite (2026-08-06)

**Ranking saves are merged on write.** Building a list is dozens of small saves — drag one
coaster, save, drag the next — and one activity row each turned the feed into a column of
"Carter ranked 1 new coaster" with the total ticking up beside it. `recordRanking` in
`worker.js` merges a ranking event into that rider's previous one while it is **under an hour
old**: counts add up, `total` and `at` become the newest, and `detail.saves` keeps the honest
number of saves behind the line.

It merges on **write**, not on read, because the feed is fetched with a `LIMIT` — one long
ranking session would otherwise fill the whole page and push everyone else off it. `/changes`
*also* folds adjacent ranking events by the same rider on the way in, because the rows written
before this shipped are still one-per-save, and because a burst can straddle a fetch. A reorder
inside the window folds into the burst; on its own it still reads "reordered their rankings".

**`activity.at` holds two formats and they must not be compared as strings.** Anything the feed
recorded is a full ISO instant; the ~99 backfilled rows carry a bare `YYYY-MM-DD` and no time.
That combination produced day headings that ran Aug 6 → Aug 5 → Aug 4 → **Aug 5 again**, because
SQL sorted the two shapes as strings and `new Date("2026-08-05")` is midnight *UTC* — the 4th in
any western timezone — while the rest of the page used local midnight. `/changes` now parses a
bare date as **local** midnight (`atTime`), sorts on the parsed value client-side rather than
trusting the order back, and shows no clock at all on a row that never had one.

The page also refreshes every 60s while it is visible, so a ranking session in another tab grows
that one line as you work.

### Worker API

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/users` | public | `{users:[{slug,name}]}`, name-sorted. The rider pickers read this. |
| POST | `/api/user` | **gated** | `{name}` (optional `slug`). Derives a URL-safe slug, refuses page names (`stats`, `rides`, …) and 409s on a clash. Records a `user_added` activity event. |
| GET | `/api/rides/:slug` | public | One entry per ride **including the row id** (`i`) so a single ride is deletable. `d` is null when the date is unknown. Undated rows sort last. No `mode` field — there is one shape. |
| POST | `/api/rides` | **gated** | `{user, d:"YYYY-MM-DD"\|null, entries:[{c,n}]}`. Validates **every** coaster id up front and 400s the whole batch if any is unknown — a typo can't half-log a day. Laps clamp to 1–50. Chunks the D1 batch at 90 statements. Returns `{added, coasters, total, credits, date}`. |
| DELETE | `/api/ride` | **gated** | `{i:<row id>}` — undo a mis-tapped ride. Returns `{credits, rides}`. |
| PUT | `/api/rankings/:slug` | **open** | Ungated on purpose — `RANKINGS_NEED_TOKEN` is `false`. See below. |

**`d: null` is explicit, not a missing field.** A null date means undated and writes **one**
row per coaster, and only if the rider has no row for that coaster already — dated or not.
"I have ridden this" is not a second ride. A *malformed* date is still a 400; null is not a
free pass for bad input.

`added` counts what the database **actually wrote**, summed from `meta.changes` across the
batch — not what was asked for, since the undated guard skips coasters already held.

#### What's gated, and why it's split that way

Carter's call (2026-07-30), after briefly gating everything and disliking it:

| | gated? | reasoning |
|---|---|---|
| `/log` — logging rides | **yes** | writes counts every other page reads |
| `/add` — new parks/coasters | **yes** | writes the list everyone shares, and there's no undo outside `/edit` |
| `/edit` — merges, deletes, geocode | **yes** | destructive |
| **rankings** | **no** | ranking is the enjoyable part; asking Carter for a password to reorder his own favourites was friction in the wrong place |

The rankings exposure, plainly: anyone who finds `PUT /api/rankings/:slug` can reorder any
rider's list. It reaches nothing else — only the `rankings` table, counts are untouched, and a
scrambled order is fixable by dragging it back. That trade was made knowingly, not overlooked.
Flip `RANKINGS_NEED_TOKEN` to gate it; the page then needs its unlock UI back, which is in git
history at **c27b43b**. The test suite asserts the *current* state both ways, so flipping the
flag fails loudly rather than silently breaking the Save button.

### Tests

```bash
node tools/test-rides-api.mjs        # 112 tests, all passing
```

Runs the real `worker.js` router against `node:sqlite` standing in for D1 — no network, no
wrangler, no `npm install`. Covers auth, validation (a bad batch must write **nothing**),
dated and undated writes, the undated dedupe guard, lap clamping, delete, which routes are
gated and which are not, rider creation (slug derivation, reserved page names, clashes),
and a regression pass over `/api/coasters`, `/api/parks` and `/api/user/:slug`.

**The D1 shim must mirror `meta.changes`.** It used to return `{}` from `run()` and `[]` from
`batch()`, which meant `added` — computed by summing `meta.changes` — was never actually
tested and would have shipped as "Added 0 coasters" unnoticed. If you extend the shim, keep
the result shape faithful.

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

### 2. ~~Milestones~~ — **removed 2026-07-29, Carter's call**

Milestone credits needed an explicit credit number (`num`), which only Max had. He said drop
them, which is what made the storage migration a clean one-to-one. Gone: the Milestones panel
on Stats and the `Credit #` column on the rides table. Both were already guarded and
self-hid without the data, so removal was two deletions.

If they ever come back they should be **derived** from first-ridden dates sorted by
`[date, coaster id]` (stable secondary key, or "your 500th" flips between loads), and the
open question is unchanged: for a partially-dated rider, does the Nth milestone count only
dated credits, or do undated ones get appended? 441 of 1,767 rows are undated, so this is
not a corner case. Label derived ones differently ("your 500th dated credit").

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
- ~~**`USERS` in `app.js` is hardcoded**~~ — **done 2026-08-05.** The list comes from
  `GET /api/users` and is merged into `USERS` (cached in `localStorage`); riders can
  be added from `/log` and `/import`. See "Riders come from D1" above. What is left
  is *who may add one*: today that is anyone with the shared password.
- ~~**The static-JSON fallback assumes a fixed set of riders.**~~ — `tools/sync-static.mjs`
  now takes its slug list from `/api/users`, so new riders get a `<slug>.json` on the
  next sync. Between being added and that sync they exist only in D1, which is fine —
  every page tries the API first and the pages that read a rider file tolerate a miss.
- **Write authorisation becomes per-row**: today any unlocked session can log a day
  for anyone. With accounts, a rider should only be able to edit their own count
  (with an admin override).

### 4. Per-rider tokens — discussed 2026-07-29, **deliberately not built**

Carter's call: leave it until it is actually needed. Worth recording *why*, since it looks
like an obvious gap.

It is **not** about privacy — every rider's count, rides and rankings are public either way.
It is about **write authorization**, and it buys three things:

- **Attribution.** The rider is a *dropdown* today, so whoever has the password picks who they
  are logging as. A mis-set dropdown quietly writes rides into someone else's count.
- **Least privilege.** One password unlocks `/log`, `/add` **and** `/edit` — merges, deletes,
  the geocoder. Letting a fifth person log rides means handing them the ability to delete a park.
- **Revocability.** Rotate one person's link instead of re-texting everyone a new password.

A link is a **bearer credential** — anyone holding the URL is that person. Fine for friends,
not for strangers, and no substitute for real accounts (§3).

**The trigger is not a user count.** It is the first time Carter wants to give someone logging
access he would not also give `/edit` access. Until then the shared password is adequate.

### 5. Sean's remaining 63 rows — **needs Carter**

604 of Sean's 668 sheet rows imported. The rest need decisions, not code.

**36 coasters at parks we already have.** Four are typos in his sheet, not missing
rides — `Millenium Force`, `Colorado Adveture`, `Surf Coaster Leviatham`,
`Wile E. Coyote's Grand Canyon Blaster`. The rest are real and should be added:
DarKoaster, Rapterra, Firebird, Chupacabra, Hurler, Shockwave, Colossus,
American Eagle, Big Bad Wolf: The Wolf's Revenge, both Snoopy coasters at
Carowinds, Dragon Khan, Tomahawk, Stampida (red), and the county-fair spinners.

**Two naming conflicts to settle:**
- Sean writes `Racer 75 [left]`/`[right]`; we store `(North)`/`(South)`. Same
  racers, and nobody has said which side is which.
- `Matterhorn Bobsleds [Fantasyland]`/`[Tomorrowland]` — we renamed those to
  `(Right)`/`(Left)`, and the old names ARE in `coaster_aliases`, but his square
  brackets omit the side word so an exact alias match misses. Either add his
  spelling as another alias or accept it by hand.

**11 parks we do not have** (25 rows): Adventure Ocean Oasis (Labadee), Alameda
County Fair, Beyond Wonderland, Casino Pier, Christmas in the Park, **Disneyland
Park (Paris)**, Lake Tahoe Amusement Park, **Luna Park (Melbourne)**, Mt. Olympus
Water & Theme Park, Victorian Gardens, **Walt Disney Studios Park**.

**Sean counts pre/post-rebuild separately** — `[old]`/`[new]` on Big Thunder
Mountain Railroad, GhostRider and Incredible Hulk. Only the Hulk is two rows for
us, so only that one kept both credits; the other pairs collapsed to one each. If
a retrack should count twice, those need splitting and it affects other riders too.

**His sheet also carries a 14-column rating rubric** (Pacing, Duration, Speed,
Positives, Negatives, Laterals, Tracking, Vehicles, Efficiency, Aesthetics,
Theming, Elements, Accessibility, Total) on 75 rides. Nothing on the site models
it and it was dropped on import. It is richer than our ordinal rankings.

#### Do not fuzzy-match park names

The import initially credited Sean's **Disneyland Paris** and **Tokyo** rides to
Anaheim, because "Disneyland" is a prefix of "Disneyland Park (Paris)". Park
matching is now exact-or-alias-or-an-explicit-hand-map only. Coaster names can be
matched loosely *within* a park; park names cannot be matched loosely at all.

### 6. Smaller items

- **110 coasters have no `type`** (Steel/Wood), which skews the steel/wood split. `/database`
  has an "Only incomplete" filter; `tools/import-captaincoaster.js` can backfill details.
  `/edit` now grades this in two colours instead of one **needs stats** badge: red **no stats**
  (nothing of `type, h, s, l, inv, yr` filled — 109 rows) and amber **some stats · n/6** with
  the missing fields in its tooltip (515 rows). 490 are complete. Manufacturer, model and
  duration are deliberately outside the count — they are genuinely unpublished for a lot of
  rides, and including them would mark most of the database unfinished.
- **The coaster table only holds coasters somebody has ridden.** Carter wants "all coasters"
  eventually. That needs a `ridden` flag (or a derived check against `rides`) plus a "show
  all" toggle — otherwise the *Everyone → Full list* view silently changes meaning from
  "everything we have ridden" to "everything that exists".
- **`/add` is reachable at `/user/<slug>/add`** via a `_redirects` 200-rewrite, left over from
  when it was a per-rider page. It renders the same page — `add` was removed from `PER_RIDER`
  in `app.js` — but the route is now meaningless and could go.
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
  St. Louis; the now-orphaned `Incredible Pizza Company` park was deleted). The specs #262
  carried turned out to describe the St. Louis ride correctly — only the park name had been
  wrong — so they were restored onto #679, which Carter then confirmed as **closed in 2024**
  (SBF Visa Spinner, opened 2016-11-04, defunct). #822 is the same model, opened 2015-07-25 and
  still operating. Both are complete now. Note the chain uses two naming styles, `<City>'s Incredible Pizza Company` and `John's Incredible Pizza Company <City>`; keep
  the city in the name so locations can't be confused again.
- **Carter's total is 2,362, not 2,400.** Might be rounding, might be ~38 rides he knows are
  missing. `/log` is the tool for filling them in.
- **Traveling shows.** Butler Amusements, Ray Cammack Shows, Davis Amusement Cascadia, Helm &
  Sons, Pouzet Group are operators, not fixed parks — no coordinates, so they're skipped on the
  map. Considered an explicit `traveling` flag on the park so the UI can label them rather than
  them looking like missing data; deferred.
- **The two Boomers parks are now `Boomers! (Fountain Valley)` and `Boomers! (El Cajon)`.**
  They really are separate parks and the old names — `Boomers` and `Boomers!` — differed only
  by punctuation, which read like a typo. The city is in the name because `parks` is keyed by
  name, so the *only* way to keep two same-brand parks apart is to make the names differ. Do
  not "tidy" them back to one.

---

## Gotchas that will bite you

0. **A green sync run does not mean every rider's file was written.** Until 2026-08-05 the
   commit step in `.github/workflows/sync-static.yml` staged a *hardcoded* list of files —
   `coasters.json parks.json carter.json cole.json keltan.json max.json`. Sean was added after
   that line was written, so `sean.json` was regenerated on every run and staged on none of
   them: the run went green, the diff simply never mentioned him, and his file sat stale for
   weeks. (That is what an earlier session was really fixing when it "refreshed sean.json by
   hand".) It now stages `'*.json'`. **If you add a step that writes a new file, do not name
   files in `git add`** — riders can be created from `/log` and `/import` now, so no fixed list
   can keep up. After any bulk data change, verify rows, credits **and** `SUM(DISTINCT
   coaster_id)` per rider against D1 rather than trusting the run's conclusion.

1. **Line endings are mixed — match the file you're editing.** `index.html` and `stats.html`
   are **CRLF**; `rides.html`, `rankings.html`, `add.html`, `log.html`, `edit.html`,
   `database.html`, `app.js`, `worker.js` and the JSON files are **LF**. Getting it wrong produces a whole-file
   whitespace diff.

2. **Watch for curly apostrophes in pasted names.** `'` (U+0027) and `’` (U+2019) look
   identical rendered but never match, so a pasted name silently creates a twin -- that is
   how Woodstock's Air Rail got into the table twice. The house style is the straight quote;
   `SELECT * FROM coasters WHERE name LIKE '%’%'` should always return nothing.

3. **Finding duplicate coasters.** They leave a fingerprint: same park, *disjoint* rider sets,
   and either identical h/s/yr or a name differing only by an article or punctuation. Genuine
   racing pairs (Gemini, Matterhorn, Racer 75, Colossus) fail that test because the same people
   ride both sides. Two queries in the 2026-07-29 session found nearly forty this way.

4. **JSON files are compact, one line, no trailing newline.** That's what
   `tools/sync-static.mjs` writes; match it or every sync produces a spurious diff.

5. **Worker entry file must stay `worker.js`.** Workers Builds runs `npx wrangler deploy` and
   wrangler rejects `_worker.js` as an asset. `worker.js`, `wrangler.jsonc` and `.assetsignore`
   are all listed in `.assetsignore`.

6. **`worker.js` uses `export default` but the repo has no `"type":"module"`.** The test harness
   copies it to a `.mjs` name to import it. Don't "fix" this by adding a `package.json` type
   field — wrangler is happy as-is and changing it risks the deploy.

7. **Caching: `_headers` cannot expire a copy the browser already has.** `style.css`, `app.js`
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

8. **Merging coasters is safe, but verify.** The pattern used throughout this project:
   `UPDATE OR IGNORE credits SET coaster_id=<to> WHERE coaster_id=<from>`, same for `rides`,
   then delete the loser **guarded** by `AND id NOT IN (SELECT coaster_id FROM credits UNION
   SELECT coaster_id FROM rides)`. Afterwards confirm every rider's credit count is unchanged.
