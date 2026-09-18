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
- **Sean was missing three — settled 2026-09-16.** Supersplash (Plopsaland) and Free Fall
  (Nagashima) stayed off his list, Roller Coaster (Hanayashiki) was added on Carter's say-so
  (that is his +1 credit). The two left out were carried as a standing note in `RIDER_NOTES`
  in `stats.html` until Carter's call that everyone on those days has them:
  `migrations/009-sean-two-credits.sql` added both, dated to the days he was already logged at
  those parks, and he is now at **672 credits / 723 rides**. The note is gone and `RIDER_NOTES`
  is empty — the mechanism stays for the next one.

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
| `log.html` | the logger, two modes (a dated park day, or a list ticked off). **Middle** slot in the mobile tab bar since 2026-09-14. Signed in it skips the password gate and locks the rider to you |
| `account.html` | sign in, sign up, claim an invite, change password, sign out. Reached from the person icon in the header |
| `migrations/` | one-off SQL, not served (see `.assetsignore`) |
| `edit.html` | gated admin editor (coasters + parks, merge, geocode) |
| `database.html` | unlisted QC page, not in nav |
| `app.js` | data engine (`computeStats`) + nav (`initNav`, `USERS`, `userPageHref`) |
| `worker.js` | Worker entrypoint — static assets + JSON API |
| `tools/sync-static.mjs` | regenerate the static JSON from the live API |
| `tools/test-rides-api.mjs` | **183 endpoint tests** over `node:sqlite` (no network), including the whole of accounts |
| `tools/dev-server.mjs` | local stand-in for the Worker — serves the repo, mirrors `_redirects`, stubs the API so `/log`, `/add`, `/edit` can be driven in a browser. Password `letmein`. It answers `/api/auth/me` as signed-out: it has no accounts table, so to exercise real sign-in run `worker.js` against `node:sqlite` the way the test harness does |
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

**Anything you hand `computeStats` must be in that shape**, including synthetic input. It reads
`userInput.rides` or a bare array and nothing else — a `{credits:[ids]}` object computes on an
empty list and returns a full set of zeroes rather than throwing. The combined tiles on the
`/stats` hub did exactly that from the migration until 2026-08-06: "0 unique coasters, 0 parks,
0/0 states" sitting above per-rider cards that were all correct. If a panel reads zero while its
neighbours look right, suspect the shape of what was passed in.

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

### The nav, and a rider's URL (2026-09-16)

Five pages, one order, everywhere — header, mobile tab bar, footer (2026-09-16, Carter's call):

**Riders · Rankings · Profile · Count · Log**

Riders is everyone and Profile is one person; they sit either side of the middle, which is the
easiest slot to hit with a thumb. **Home is gone from the nav and `/` 301s to `/riders`** — the
landing page was a tour of a site you are already on. `index.html` is untouched and still served
at `/home`, linked from the site map.

On a phone the **Profile tab wears your picture** when you are signed in and have one (see
`buildTabBar`), and the outline of a person when you do not — the same placeholder the riders
list draws. Tab links carry `data-nav` so the header's retargeting reaches them too.

**Profile always means YOUR profile** when you are signed in (2026-09-16) — header link and
mobile tab alike, on every page, including while you are reading somebody else's. It is the way
back: landing on your own page re-remembers you, so Count and Rankings come with you. Those two
still follow whoever you are reading, which is the point of the picker. `applyRiderLinks` holds
the rule and `myOwn` (from `/api/auth/me`) is null for a visitor, for whom Profile keeps meaning
the page they are on.

**"Viewing <name>" only appears on the three pages that show one rider** (`PER_RIDER`:
profile, count, rankings). On `/riders` it contradicted the page, and on `/log` the rider comes
from the form's own dropdown, so it was two answers to one question.

Add new is not a tab:

- **Log** is a button in the profile hero, under the number it changes, shown only to whoever
  may write to that count (its owner, or Carter for riders who haven't claimed their page). It
  keeps a footer link. It was the centre tab; a tab is somewhere you go, and this is something
  you do, to one rider's count.
- **Add new** stays desktop-header-and-footer, as it always was: admin only, occasional, and
  never one-handed at a park.

**Count** is `/rides` — the day log, every ride and the full credit list in one page. "Rides"
read as a twin of "Log" and neither label said which one wrote.

**Your own profile lists what you can do** (2026-09-16): under the two numbers, three buttons —
**Log a day**, **View your count**, **Update your rankings**. Carter's ask was to make the
options visible rather than scattered across a header; the page already says what you HAVE, and
this says what you do with it. It reached six and came back to three: filling in old credits is
a button on the count page itself, and adding a missing coaster belongs to the shared list
rather than to yours.

Only "View your count" shows to everyone (it reads "View Sean's count" on his page, "See
everyone's rides" on the hub); the two writes would 401 on a visitor, so they appear for the
owner, or for Carter on a rider who has not claimed their page. `?mode=list` on `/log` exists
for the count page's button — the log's two modes are different jobs and a link has to be able
to name one.

**`/stats` is gone (2026-09-16).** It used to serve two different pages from one file: a rider's
profile and the everyone view. They are two files now.

| page | file | URL |
|---|---|---|
| one rider | `profile.html` | `/user/<slug>` (a 200 rewrite; the browser keeps the pretty URL) |
| everyone | `riders.html` | `/riders` |

`/stats` 301s to `/riders`, which is what somebody typing it most likely wanted. The page key is
`profile` now, not `stats` — `PER_RIDER`, `TABS`, `data-nav`, `initNav('profile')`. A profile
with no person is not a thing, so `userPageHref(null, 'profile')` is `/riders`, and
`profile.html` with no rider in the URL redirects: to your own page if you are signed in, to
`/riders` if not.

**`/riders` opens like a front page** (2026-09-16), because it is one: the badge and the track
art came over from the old landing page's hero, the headline is "A home for your coaster count",
and two paragraphs follow — the first about the site ("Welcome to Coaster Hub. Track your
coaster count. Rank your credits. Log your rides."), the second about this page ("Pick a rider
below…"). `.hero p + p` styles that second one quieter and closer. Its `<title>` is the site's,
not the section's.

**The riders list** is one row per person in the same shape as the identity block on a profile
— picture, name, `@username`, then the count as a quiet line underneath ("562 credits / 2,394
rides"). One number sits on the right: **coasters ranked**, from `/api/rankings/<slug>`, one call
each. Parks came out; four numbers of equal weight made every rider read as a spreadsheet row.
The whole row is the link. Underneath the list is the **recent-changes feed**, the same one
`/changes` draws.

`adoptUsers()` carries `avatar` through from `/api/users` — it used to rebuild the list as
`{slug, name}` only, which is why every row drew an initial instead of a photo.

**`changes-feed.js`** is that feed, lifted out of `changes.html` so both pages can draw it:
`CoasterHubFeed.mount({ feed, note, filter, limit, poll })`. `/changes` mounts it whole, with its
filter bar and a 60s refresh; `/riders` mounts twelve rows with neither. Its CSS moved to
`style.css` for the same reason. Add an event kind in one place now, not two.

**A ranking opens read-only, even your own** (2026-09-16). `#mine` carries `.readonly` from the
markup; whoever may edit gets an **Edit** button, which takes it off and brings back the drag
handles, the row buttons, the Add coasters tab and Save. A ranking is read far more often than
it is changed, and a screen of drag handles is a screen you can break by mis-tapping. It also
means your own list looks exactly like everybody else's until you ask for it not to.

Rows are deliberately tight — a ranking is scanned down a screen, so height is coasters you
cannot see. On a phone the name and park used to wrap, which made every row a different height;
both ellipsise now. Editing, the number tucks against the drag handle rather than sitting apart
from it, because everything it is not is name and park.

**`/rankings/all` is the whole shared list** (2026-09-16) — `rankings-all.html`, reached by a
200 rewrite. `/rankings` shows the ten most agreed-on and links here when there are more; it is
deliberately not in the nav. Two sort orders, because "agreed on" means two things: how many
people rank it, or how high the people who rank it put it. Each row names who has it and where
they put it. Only coasters on more than one list qualify — one person's number one is not a
consensus.

The `/rankings` summary itself was reordered the same day: **shared favorites above each
rider's list**, which is the interesting half and was sitting under six cards of other people's
top fives. Those cards are smaller now and show three names instead of five.

**`/count` has three views** (2026-09-16): **Rides** (the day cards), **All coasters** (the credit
list that came over from `/coasters`), **All parks**. Deep links: `?view=list` and `?view=parks`.

The flat ride table went with this change — it was the same rides as the day cards with none of
the grouping, and its sort machinery (`cols`, `buildHead`, `renderAll`) came out with it. A
rider whose credits carry no dates has no day view, so they open on All coasters.

**All parks** is every park in the count, A–Z, each one a `<details>` that opens the way a day
does, listing the coasters ridden there with lap counts. A day answers "what did I ride that
afternoon"; a park answers "what have I ridden here, ever", which is the question you have
standing in a queue somewhere you have been before. Undated credits DO appear here, unlike in
the day view — a credit with no date still happened at a park.

**No dates on a park row** (2026-09-17). Each row used to carry the date that coaster was first
ridden, and nobody could read it: on a park card the obvious meaning is "when I was here", so a
park visited three times showed three different dates down one column. Dates belong to the
Rides view, which is organised by them. Carter's call.

**The model on every list row** (2026-09-17). `CoasterHub.maker(c)` returns the **model**, not
"manufacturer model": most models already carry the maker's name ("RMC Hybrid"), so the pair
read as a stutter — "Rocky Mountain Construction RMC Hybrid". A coaster with a manufacturer
and **no** model falls back to the manufacturer, because there is no stutter to remove there
and "Philadelphia Toboggan Coasters" beats an empty space; with neither filled it returns an
empty string and no separator appears anywhere. `migrations/011-4d-models.sql` folded the maker
into the model for the three 4D coasters, whose model was the bare and meaningless "4D". It is used in four places: the `/count` park rows (beside the name, before the
status), and the sub-line of the three ranking lists — `/rankings`, `/rankings/all` and the
profile's top ten — where it follows the park and region. One definition in `app.js`, because
four copies of the same join is how they drift.

**Status and lifespan on a park row** (2026-09-17). What replaced it, and note it is a
different fact entirely: the COASTER's own years, not the rider's. Running coasters show the
opening year; defunct ones show the span they existed for — `1980–2013` — which says more than
either year alone. "Defunct" means the row has a closing date. The status word carries the
colour (`--accent2` teal for running, `--accent` red for gone, the site's own two accents) and
the years stay in the body colour, because the years are the fact and the status is the flag on
it. Both scopes, global and per rider. Below 560px the word collapses to a coloured dot — a
phone row has no width for a word, a span and a name. `opened` falls back to `yr` when only the
year is known, and a coaster with neither shows nothing rather than an empty gap.

**The global view drops every number that is a sum** (2026-09-17). Viewing everyone, "3 visits"
is not a trip anybody took, "21 rides" is six people's rides added together, and "×3" is not a
re-ride — so visits, the ride total and the per-coaster lap counts are all absent there. How many
coasters the park has between you survives being added up, so it is the one figure the card
keeps. A single rider's view is unchanged and keeps all four.

**The count page is `/count`** (2026-09-16), not `/rides` — `count.html`, `initNav('count')`,
`PER_RIDER`'s `count` key. It holds a rider's whole count (the day log, every ride, the full
credit list) and "rides" named one of the three. Both old paths 301 — `/rides` → `/count` and
`/user/<name>/rides` → `/user/<name>/count` — and `/coasters` now lands on `/count?view=list`.
Its hero carries **Log a day** and **Add to your count** for whoever may write to that count.
`count` joins `rides` in `RESERVED_SLUGS`; both stay, because both still resolve.

**A rider's profile is `/user/<slug>`**, not `/user/<slug>/stats`. The page opens with their
picture, name and count: it is the person, and `stats` was a filename showing through. Their
other pages keep the suffix because they are *about* that person — `/user/<slug>/rides`,
`/user/<slug>/rankings`. `_redirects` 301s the old form to the new one (after the
`/user/:name` rewrite line, since the first matching rule wins), and `<title>` is now
"<Name> — Coaster Hub".

Every link to a rider's page goes through `CoasterHub.userPageHref(slug, page)`. That function
is the only place that knows the shape of these URLs — header links, the rider picker, the tab
bar, the hub cards, the home page and `/account`'s redirects all call it. Build one by hand and
it will be the one that rots.

### Wanted, not built yet: pages for a park and for a coaster (2026-09-17)

Carter's, for later: open a park or a coaster as its own page — the global ranking it sits at,
how many riders here have it, who has ridden it and where they put it, the specs. The data is
already there (`/api/coasters`, `/api/parks`, every rider's rides and rankings); what is missing
is the URL scheme (`/park/<slug>`, `/coaster/<id>`?) and a decision about what leads each page.
Nothing on the site links to such a page yet, so it can be built whole rather than in pieces.

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

### `/log` — **two modes** (2026-07-29), account-gated since 2026-09-14

Middle slot in the mobile tab bar (2026-09-14 — it is the easiest slot to reach with a
thumb, and logging is the thing done one-handed in a queue). Signed in, the gate is skipped
and the rider dropdown is locked to you; signed out, the shared password still works. One park picker, two ways to add:

**"Near me" sorts the park list by distance (2026-08-06).** 247 parks alphabetically is a long
scroll to reach the one you are standing in. The coordinates are already loaded with the parks,
so this is a **sort, not a lookup** — no service, nothing sent anywhere, the position never
leaves the browser. Parks within 60 miles go in a "Near you" group, nearest first with the
distance in the label; everything else stays A–Z below, including the 16 parks with no
coordinates, which can't be placed but must not disappear.

Three deliberate choices: it is a **button**, because a permission prompt nobody asked for is
worse than a scroll; the fix is kept for **two hours**, long enough for a park day and short
enough that tomorrow at a different park it doesn't silently sort by where you were yesterday;
and it **auto-selects** the nearest park only when it is within a mile *and* nothing is chosen
yet, so it can never move a park you set yourself.

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

### Home: "Recent days out" opens in place (2026-08-06)

Each day on the home feed is a `<details>` that expands to the coasters ridden, with `×N` on
re-rides — the same shape as the day cards on `/rides`, built from data the page already has

**Neither one repeats the park on every row.** It shows only when the day actually spans more
than one park; otherwise it is already in the summary directly above, and on a phone it stole
the width the coaster names needed (`Flash: Vertical …`). Keep the two in step — they are the
same card in two places.
(it loads every rider's log and the coaster list to compute the leaderboard). The row used to be
a link to that rider's log; that link moved inside the opened panel, so nothing that was
reachable stopped being so.

**The mobile rule to watch:** `.fitem` is the `<details>` now, and the flex row is
`.fitem > summary`. The `@media` block still pointed `flex-wrap` at `.fitem`, which left the
summary unable to wrap — on a phone everything past the date ran off the side. The caret is last
in the markup but is reordered onto the first line at narrow widths, with `margin-left:auto` to
eat the slack; that is what forces the break, rather than hoping the column widths land right.

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

**Renames and merges name the park.** Two coaster names and no place is a riddle — the same
retheme lands at six Six Flags parks. New events carry `detail.park` (the rename path reports the
*new* park when an edit moved it too; a merge reports the surviving coaster's, falling back to the
one merged away, read before its row is deleted). The 99 backfilled rows never had it, but each
carries the coaster id it ended up as, so `/changes` fetches the coaster list **alongside** the
feed and fills the park in on a second render — the feed never waits on 1,100 coasters to draw,
and a failed fetch just leaves the sentences bare. Note the two shapes when reading old rows: a
merge written live puts the id in `from` and the name in `fromName`, while the backfill put the
**name** in `from`.

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
| **rankings** | **no** | ranking is the enjoyable part; asking Carter for a password to reorder his own favorites was friction in the wrong place |

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

## Claiming picks its own name and username (2026-09-17)

The names the five riders arrived with are **placeholders** Carter typed to get their counts
into the site. Claiming is where a count becomes somebody's own, so the claim form asks for a
**display name** and a **username**, both blank rather than prefilled, and the old ones need
never be seen. The claim pane no longer prints the rider's name either — the invite already
proves which count it is, since it opens exactly one.

Both fields are optional at the API: send neither and nothing moves, which is what the older
tests exercise.

**Order matters, and it is deliberate.** Validate → hash → rename → set the name → insert the
account. The password is hashed before anything is written (same rule as signup: D1 has no
transaction across these statements), and `renameRider()` runs *before* the account is
attached, so the account is inserted against the final slug and there is never a window where
the two disagree. A refused username — taken, reserved, too short — fails before any write, so
the invite stays unspent and no account is made.

**`renameRider(env, from, to, quiet)` gained a fourth argument.** A rename normally belongs in
the activity feed: it is a public name changing under people's links. A rename at claim time
does **not**, and passing `quiet` skips the row — announcing "keltan is now Kel" would publish
the one thing claiming exists to retire. Nothing about the claim reaches the feed.

Everything else already worked and is covered by tests: the rides, the ranking, the invite
being spent, and the old `/user/<placeholder>` going to a clean 404.

**Signup's first field is now labelled "Username"**, not "Your name" — it always was the thing
that becomes `/user/<you>`, and the hint under it said so while the label did not.

---

## Getting to the D1 console

Asked twice now, never written down. The database is named **`coasterhub`**, id
**`d4742d82-f606-498a-8520-bcbfec7dcf91`** (both from `wrangler.jsonc`).

Straight there, without picking the account first:

```
https://dash.cloudflare.com/?to=/:account/workers/d1/databases/d4742d82-f606-498a-8520-bcbfec7dcf91
```

The `?to=/:account/...` form lets the dashboard fill in the account id itself. Then the
**Console** tab, paste, **Execute**.

By hand: dash.cloudflare.com → **Storage & Databases** → **D1 SQL Database** → **coasterhub**
→ **Console**. Cloudflare moves that left-hand menu around (it has been under "Workers & Pages"
and under "Storage & Databases"); if the label has changed again, search the dashboard for
"D1" or use the link above.

**After raw SQL, the static JSON is stale.** A D1 console write does not go through the Worker,
so it records no activity and fires no repo-dispatch — run the **Sync static JSON** action by
hand if the change touched counts or rankings. A schema-only migration (a new table, an index)
changes neither, so there is nothing to sync.

---

## Credit bursts merge in the feed; dated rides do not (2026-09-17)

Ticking a park's list, saving, picking the next park and saving again is **one sitting**, not
six things that happened — but it filled the feed with a column of "added 1 coaster to their
count". Credits now merge exactly the way ranking bursts have since 2026-08: a save folds into
this rider's last credits row while that row is under an hour old, chaining, so an hour of
steady work stays one line however many times it was saved.

**Dated rides are deliberately left alone.** Each is a day out at a named park and reads as a
fact on its own; merging them would throw away the park and the date, which are the only
interesting parts.

Done in **both places**, as ranking is:

- `recordCredits()` in `worker.js` merges on write, so new rows are clean.
- `groupRuns()` in `changes-feed.js` folds adjacent same-kind, same-actor events on the way in.
  This is the half that matters for rows **already in the table** — a server-side merge alone
  would leave every existing "added 1 coaster" line exactly as it is. `groupRankings()` was
  renamed and generalised; `GROUPS` is the set of kinds that fold, and adding a third means
  adding its merge arm.

One trap when testing this: the undated guard skips a coaster the rider already holds, so a
save of one they have writes **no rows and records no event**. A test that re-ticks the same
coaster looks like the merge failing when nothing was recorded at all.

---

## Following (2026-09-17)

`migrations/010-follows.sql` — **Carter still has to paste this into the D1 console.** Until
he does, `/api/follows/:slug` and `/api/follow/:slug` both answer **503 naming the file** and
the profile page draws no follow line and no button at all. That is the designed state, not a
broken one: the page is exactly what it was before.

One table, one row per "A follows B", both sides a **slug**:

```sql
CREATE TABLE follows (follower TEXT, followee TEXT, at TEXT, PRIMARY KEY (follower, followee));
CREATE INDEX follows_followee ON follows(followee);
```

Slugs rather than account ids because everything else here is keyed by slug and a rename
already rewrites them everywhere — `renameRider()` moves `follows` too, in its **own**
try/caught batch rather than the main one, so a rename still works on a database that has not
run 010.

The pair is the primary key, so following twice is a no-op (`ON CONFLICT DO NOTHING`), which
is what two tabs and a double tap actually do.

### The rules, and where they live

| rule | enforced | why not in SQL |
|---|---|---|
| you cannot follow yourself | Worker, 400 | product rule, not a data rule |
| you cannot follow an **unclaimed** rider | Worker, 409 | Carter's call, 2026-09-17: there is nobody on the other end of a page nobody has claimed. It relaxes on its own the day they claim it — no migration, no code change |
| you must be signed in **as a rider** | Worker, 401 | the shared admin password is not a person, and following is one rider doing something to another |

`GET /api/follows/:slug` is public and answers the whole question in one round trip: both
lists as people (`slug`, `name`, `avatar`), plus `claimed`, `me` and `you`, so the button
never has to work out whether it should exist. `POST`/`DELETE /api/follow/:slug` return the
**fresh lists** with the answer, so the count under the bio moves in the same frame as the
button above it.

**Deliberately not in `activity`.** That feed is what changed about the coasters and the
counts; a column of "Carter followed Cole" would bury the rides. Revisit only if the feed
grows a social tab.

**No `afterWrite()` on a follow.** The static JSON snapshots are counts and rankings; a follow
changes neither, so there is nothing to re-sync and no reason to spend a repo-dispatch on it.

### On the page

Under the bio, in the bio's own voice — `.followline` copies `.bioline`'s size and colour
because it is one more line about who this rider is. Both counts are links; clicking one opens
the list of who underneath, clicking it again closes it. The button lives in `#hero_acts`
above "View <name>'s count": **red** (`.btn`, same as "Log a day") while you are not
following, **outline** (`.btn.alt`) once you are — the loud one is always the thing you have
not done yet. It is a real `<button>`, which is why `style.css` has a
`.heroacts button.btn` rule giving back the font a button resets; it is deliberately *less*
specific than `.heroacts .btn.alt` so Unfollow keeps its outline.

Follower counts are not on `/` yet. The eventual idea is that the home page shows only people
you follow; it shows everyone for now, which is right while there are six riders.

---

## Why a replaced avatar came back old (2026-09-17)

Carter, after re-uploading his picture: "at first it looks funky but when I click on it it's
fine — maybe old pfp is still cached?" He was right about the cache and it was not R2's.

**Nothing behind `/api/` was sending `cache-control`.** That is not "do not cache": with no
max-age and no validator, a browser falls back to **heuristic freshness** and may serve a
cached response for a while without revalidating (Safari especially). So `/api/auth/me` came
back from the browser cache carrying the **previous avatar key**, and the page drew that file
— which is also still in the same browser's cache, because avatars are served
`immutable, max-age=31536000`. Two correct caches, one wrong picture. The next real request
fixed it, which is the "fine when I click it" half.

Note what was NOT wrong, so nobody re-fixes it: the upload mints a **fresh key every time**
(`slug + 16 random hex`) precisely so the immutable header is safe, and it deletes the old
object. The crop is faithful too (see the crop section). The bug was only ever that the JSON
naming the key could be stale.

Now: `JSON_HEADERS` carries **`cache-control: no-store`**, so every JSON answer including
errors is uncacheable. `/api/coasters` and `/api/parks` — ~900 rows between them, fetched by
nearly every page, changing only when somebody adds a coaster — opt back in with an explicit
`public, max-age=300`, which is both faster and safer than leaving a browser to guess.

**A new endpoint returning live or per-user data needs nothing. One that wants caching has to
say so.** Ten tests assert the split.

---

## Top ten on a profile (2026-09-17)

**Above** the stat tiles (moved there 2026-09-17, Carter's call: what somebody liked best is
more interesting than how many states they have been to), a rider's ten favorites, with the
**heading as the link** to their whole list — Carter did not want a separate "see all" button repeating it. The `<h2>` carries an
`<a class="toplink">` whose href is built in `render()` (same reason as the hero numbers: the
`data-nav` pass has already run). The trailing arrow reads "all 14 →" when there are more than
ten and "the whole list →" when there are not.

**It costs nothing extra.** Both the rows and the "N ranked." hero line come off the *same*
`/api/rankings/<slug>` fetch, and the names come from `s.coasters`, which `loadUser()` has
already brought in.

It also takes the tightened `padding-top:28px` that belonged to the tiles as the first block
after the hero, and `renderTop()` clears the tiles' own tightened padding when it reveals
itself — so whichever of the two leads the page gets the tight spacing and the other gets the
normal 64px. Hidden outright when nothing is ranked (`#sec_top` starts `display:none` and
`renderTop()` simply returns), and then the tiles lead again with their tight padding intact: an empty top ten is not a fact about somebody, it just means they have not got
round to it. Ids that no longer resolve to a coaster are dropped — an id can outlive the thing
it named.

---

## Closing the gaps on a phone (2026-09-17)

Carter, on the phone profile: "close all those gaps." Three of them, and only one was a
spacing value:

1. **`.hero p + p` was overriding `.followline`.** The follow line is a `<p>` that follows the
   bio's `<p>`, and that selector — one class plus two elements — outranks a bare single
   class, so *every margin `.followline{}` declared was dead*. Its real spacing had been
   coming from a rule meant for a second hero paragraph. Now `.hero .followline`. The
   `margin-top` is deliberately **−18px**, which is what that rule had been giving it and what
   Carter signed off on — not the −8px that never applied.
2. **An empty `.profedit .msg` was holding 29px under every profile, forever.** Its
   `min-height:1.2em` is there so a save message does not shove the card about, but there is
   one at the *bottom* of the card that is empty on every visit. `:empty{display:none}` now
   collapses it; the one small shift when a save reports back is cheaper than the permanent
   gap, and it lands on the thing you just did.
3. The actual spacing: `.herotop` row gap 26 → 12, `.heroacts` margin-top 16 → 10, the follow
   line 14 → 8, all inside the 680px block.

The hero went from 357px to 339px on a 390px screen with the tiles no longer pushed off it, and
on your own page — which also carries the bio and the account buttons — the whole thing now
fits one screen.

---

## The avatar crop bakes the photo first (2026-09-17)

Carter, after re-uploading many times: "still having the issue with photos not cropping
properly". Three separate checks had said the maths was right, and they were all correct —
about the wrong file.

**A photo taken upright on a phone is not stored upright.** It is a landscape bitmap —
4032x3024 — with an EXIF tag saying "rotate this 90 degrees". Browsers apply that when they
*display* an `<img>`, so `naturalWidth/Height` report the upright shape and the crop preview,
which is CSS background sizing, looks perfectly right. But `drawImage()`'s **nine-argument**
form, the one that takes a source rectangle, has a long WebKit history of reading those
coordinates in the **raw, unrotated** space. The preview frames one region and the canvas saves
a different, rotated one, and dragging cannot fix it because both halves are behaving
consistently with themselves.

`loadImage()` now **bakes** the photo onto a canvas before anything measures it: the browser
applies the orientation once, in the plain three-argument draw that every engine gets right,
and a canvas carries no metadata, so every later measurement and the final crop are in the same
space by construction. The working copy is capped at **1800px** on its long edge — the output
is 256px so nothing is lost, and it keeps a 12-megapixel photo well under iOS's canvas limits.
The preview's background comes from a data URL made once at bake time (`canvas.previewUrl`),
since a canvas has no `.src`.

### Why nothing here caught it, and what to do about that

**A synthetic PNG carries no EXIF at all.** Every test written for this — the eight-band
image, the three zoom levels — ran in Chromium against a generated file and agreed the crop
was faithful. It was. The bug lives entirely in the gap between a rotated source and an engine
that disagrees about which space a source rectangle is in.

`scratchpad/rotated.jpg` (built by `mkexif.mjs`) is a landscape JPEG carrying Orientation=6,
with four labelled colour quadrants so the saved region is readable from its pixels. **Use it,
not a generated image, if you touch this code.** Note its limit: Chromium handles the
nine-argument form correctly, so the test produces identical output before and after the fix —
it proves the bake does not regress anything, not that Safari is fixed. Reproducing that needs
a real iOS device.

---

## The avatar crop opens near the top of a portrait (2026-09-17)

Carter said his picture was "cropped weird". **The crop pipeline is faithful** — verified by
framing the middle square of an eight-band test image and reading the saved 256px JPEG back:
bands 2–5, exactly as framed. Nothing between the canvas and R2 distorts anything, and no
avatar box can crop it either, because a square image in a square box under `cover` is an exact
fit.

What was wrong was where the frame *started*. `openCrop()` centred the window vertically, and
faces live in the upper third of a portrait photo, not the middle — so the default reliably
framed somebody's chest, and the result looked wrong for a reason nobody could name. A tall
image now opens with the window near the top (`-sh * 0.10`, clamped); wide and square images
still open centred. Dragging is unchanged.

Anyone whose picture predates this can just re-upload it.

---

## The hero numbers are the navigation (2026-09-17)

On a profile, "562 coasters." and "2,394 rides." go to that rider's count and "125 ranked." to
their list. Carter's call: he did not want a row of link-coloured lines under them saying the
same thing twice.

Real `<a>` elements with a real `href`, not click handlers, so they middle-click and copy and
say where they go. **The href is built in `render()`**, not left to `initNav`'s `data-nav` pass
— that pass runs before `render()` has created these, so a `data-nav` attribute would never be
resolved and every one would point at the bare `/count`.

Styled `color:inherit;text-decoration:none`, with colour on hover as the only cue: an underline
under a 2.3rem headline reads as damage.

**The trap this walked into.** `.herotop.split .herocount h1 span{display:block}` is what puts
one number per line. The moment those spans became anchors all three collapsed onto one line,
because the rule named `span`. The selector now names `span` and `a`. Sixth instance of the
family in CLAUDE.md's list: a rule that names an element rather than what it means.

---

## Hero padding, and why it is not inline any more (2026-09-17)

Every page used to carry `style="padding:56px 0 26px"` on its hero. **An inline padding beats
any stylesheet rule, media query or not**, so there was no way to tighten the top of the page on
a phone without an `!important` or an edit to eleven files every time the number changed.

Each hero now sets **`--hero-t` and `--hero-b`** inline instead, and `.hero` in `style.css`
reads them with longhand `padding-top` / `padding-bottom`. Every page's desktop value is
unchanged (52–60 top, 20–36 bottom); the difference is that the declaration now lives
somewhere a media query can reach.

Below 680px the top drops to **18px** and the badge's bottom margin to 14px. 56px of empty
gradient above a one-line badge was the most expensive thing on a phone screen, and the rider
picker — the first thing you want to reach — started a third of the way down. Each page's
`--hero-b` still decides its own bottom.

If you add a page, give its hero `--hero-t`/`--hero-b`, not `padding`.

---

## /import is open to any signed-in account (2026-09-17)

It used to demand the **admin** password or an admin account. Carter's call: everybody who
would use it is signed in, so the password was a wall in front of a door that is already
locked. Signed out you still get a gate, and it now offers **Sign in** first with the shared
password underneath, the same shape as `/log`'s.

**This is not a hole.** The Worker's `mayWriteRider()` decides whose count may be written to,
and it sits on `/api/rides` *above* the admin gate — an ordinary account importing for someone
else gets a 401 however the page is dressed. What the account level changes is the **rider
picker**: signed in as a rider it is locked to you and disabled, because offering the list
would only be a way to earn that 401. Admins and the shared password keep the full list.
"+ Person" (which calls the admin-only `POST /api/user`) stays hidden for everyone else.

---

## The log page, decluttered (2026-09-17)

Carter: "I like the functionality but the look is too cluttered." Four text rows came out
between the top of the page and the first control:

- **"Coaster or park not in the database? Add it here"** — deleted. The job it pointed at is
  already on screen at the moment you need it: **+ Park** beside the picker, **+ Coaster not
  listed** over the coaster list.
- **The two uppercase field labels** (`PARK`, `OR SEARCH ALL COASTERS`) are no longer drawn.
  The controls under them already say what they are — "— pick a park —", "Search every
  coaster…". The `<label>` elements are still there, carrying `.vh`, so a screen reader still
  gets them; this is a visual change, not a semantic one. **Do not delete the labels.**
- **The mode hints** are one line each now. The long one pointed at `/import`, which is a link
  two inches above it, and spelled out what the `+` buttons already show.

Also: the "Import a list →" link carried `class="ghost"`, which on that page is a **button**
selector (`button.ghost{}`), so it had no styling at all and rendered as bare text beside a
pill switch. It has its own rule now.

---

## Near me, and finding a park at all (2026-09-17)

`/log`'s park field has three ways in now, and the point of all three is not scrolling 247
options.

**The three nearest parks are buttons**, not a sentence. It used to name the closest one
("Closest: Oakland Zoo, 7.9 mi") and then leave you to go and find it in the dropdown, which
is the scroll the button existed to save. All three are pressable, the selected one is marked,
and `choosePark()` is the single way in for every path that picks a park for you — a button,
the standing-in-a-park auto-pick, or a filter that narrows to one match.

**A filter under the select** narrows the dropdown rather than being a second list beside it,
so the park is still chosen in exactly one place. Two rules worth keeping:

- the park you have already chosen always survives the filter, or typing silently blanks your
  selection and empties the coaster list under it;
- at two or more characters, a single remaining match is selected for you — typing IS choosing
  once there is nothing left to choose. Two, not one, so a keystroke cannot land you in a park
  by accident.

The match count rides in the select's placeholder ("— 3 of 247 parks —"), which is chrome the
select already had, so the filter needs no label of its own.

**"Don't worry about the stats."** The add-a-coaster form says so outright now. People were
treating a missing height and speed as something they had to go and look up before they could
log the ride they just took; name and type is all the form asks for, and the rest gets filled
in later.

---

## The profile on a phone (2026-09-17) — **a draft**

Carter's words: "works for me — design will change, so do that as a draft." So this is the
shape, not the finish. Expect to move things; do not treat the order below as settled.

Below 680px the profile reads:

1. **the person** — picture, name, username, followers, the three numbers, the buttons
2. **the five tiles**, two up
3. **the map**
4. **"More stats"** — one button, and behind it: On this day, Personal bests, the calendar,
   and both rows of charts

Everything is done with **`order`** on `#content` inside the 680px media query, not by moving
the markup: the desktop page keeps reading in the order it was written, and there is one page
rather than two. `body.moreclosed` is added on load by the script — always, because the class
does nothing above 680px, so there is no width to test and nothing to get wrong when the phone
turns sideways.

**The one trap.** Chart.js measures its canvas when it draws, and the hidden sections are
`display:none`, so a chart drawn while closed comes back a pixel tall. `drawCharts()` fills in
`MORE_RESIZE()` and the toggle calls it on the way out. If you add anything else that measures
itself — a chart, a map, a virtualised list — behind that button, it needs the same treatment.

The heatmap is fine: it is an SVG built at a fixed cell size, and `.hm-wrap` already scrolls
sideways.

The tiles are forced to `1fr 1fr` rather than left on `auto-fit minmax(140px,1fr)`, which drops
to a single column at 320px and turns five tiles into five screens.

---

## The rider switcher is the hero badge now (2026-09-17)

The "Viewing <name>" pill in the header is **gone**, and with it `renderPeople()`, `sizePicker()`
and the `.userpick` / `.whoami` CSS. Two controls answering "whose page is this?" — a pill top
right and a badge over the headline — was one too many, and the header one was the one nobody
looked at. The answer belongs beside the words it changes.

`CoasterHub.riderBadge(host, page, slug)` replaces a `<span class="badge">` with a button
wearing the same pill, plus a chevron, and a menu of riders under it.

**The menu lives at the end of `<body>`, positioned `fixed` by `place()`** — not inside the
badge. `.hero` is `overflow:hidden` (it clips its own gradients and the track SVG), so a menu
absolutely positioned within it is cut off at the hero's bottom edge. On a desktop the hero was
tall enough to hide that; on a phone, and more so after the hero padding was tightened to 18px,
the list was sliced in half and **the last rider could not be reached or scrolled to at all**.
That is the same trap `profile-edit.js` already records for the crop dialog. `place()` measures
the button on every open and lifts the menu if it would run off the bottom of the screen;
scrolling closes it rather than leaving it floating, and the scroll box's
`overscroll-behavior:contain` keeps scrolling the *list* from reaching that handler. It is on all three
per-rider pages, which is the point: they behave alike.

| page | badge reads | menu |
|---|---|---|
| `/count` | the rider, or **Global** | Global + every rider |
| `/rankings` | the rider, or **Global** | Global + every rider |
| `/user/<slug>` (profile) | the rider | riders only |
| `/rankings/all` | always **Global** | Global + every rider |

On `/rankings/all` the badge is passed `currentUser()`, which is empty there — that page is the
global list whatever rider you last looked at, so it reads "Global" even with one remembered,
and the menu is the way out: a name goes to that rider's list, Global goes back to `/rankings`.

**No Global on a profile** — a profile is one person by definition, and `/profile` is not a
page. `GLOBAL_PAGES` in `app.js` is the switch; anything not in it gets riders only.

Picking a rider does exactly what the old `<select>` did: remembers the choice in `ch_rider`
so the rest of the nav follows you, then goes to `userPageHref(slug, page)`. Global clears the
memory and goes to `/<page>`.

**Nothing may write to `.hero .badge` on these pages any more.** Setting its `textContent`
takes the chevron and the menu with it. `count.html` had two such lines ("The log" / "The
credit log" / "Everyone") and `rankings.html` one ("Everyone"); all three are deleted, and the
headline under the badge already names the rider and the page. `account.html` has its own
`#hero_badge` and does **not** call `riderBadge` — leave its `textContent` writes alone.

`#people` still exists in every header. It is the third column that keeps the menu centred, and
it holds the theme toggle and the account avatar.

---

## The log page, rebuilt around the park (2026-09-17)

Five complaints, one shape: the page made you answer questions before it would let you do the
thing.

**The bug that made a park do nothing.** Browsers restore the value of a `<select>` across a
reload or a back button, and they do it *after* the script has filled the options. You arrive
with a park in the box and the empty "pick a park" list beside it — and picking that same park
again fires **no** change event, because as far as the browser is concerned nothing changed.
There is no way out of it by clicking, which is exactly what Carter reported. `renderList()`
now records the park it drew (`SHOWN`) and `syncPark()` reconciles the select against it on
load, on a `setTimeout(…,0)` after the fill, and on `pageshow`. The picker also listens for
`input` as well as `change`, since mobile browsers disagree about which they send.

**The rider pill is gone.** Signed in as yourself there was never anything to choose — the API
refuses a write to anyone else — so it was a control that could only be wrong. Admins and the
shared password still need it and get a sentence instead: "Logging for Carter · change", which
opens the old picker. The `<select id="rider">` is still in the DOM, so everything that reads
`$('rider').value` is untouched.

**"Near me" always lifts the three nearest parks**, however far away they are. The old 60-mile
cutoff meant the button did nothing at all unless you were already at a park, which is when
you least need it.

**The date moved down beside Save**, because it is the last thing you decide: pick a park,
stage the rides, then say which day.

**The basket groups by park and counts them.** Staging has always survived a change of park —
nothing said so. Credits mode totals "3 coasters / 2 parks" instead of "no dates", which is
the number you are working against on a trip.

Modes are named for the jobs now: **Log rides** and **Add credits**.

**Add credits takes an optional first-ridden date** (2026-09-17). The field stays on screen in
both modes; only its meaning changes. Day mode: "Date", defaults to today, required. Credits
mode: "First ridden", **blank**, optional — blank still writes an undated row exactly as
before, and a date writes it onto the rows in that batch.

It is deliberately **not** defaulted to today in credits mode. Today is almost never the answer
when backfilling years of riding, and a prefilled date is one you have to notice to remove —
which is how every coaster somebody ever rode ends up stamped with the afternoon they typed it
in. The date is kept between batches though, so a trip can be entered park by park without
retyping it.

No API change was needed: `addRides` already took `d` or null on any write. Note the guard it
documents — an *undated* entry is skipped when the rider already holds that coaster, a *dated*
one is not, because riding something twice in a day is real. Credits mode cannot hit that:
coasters you already own render inert there, so they never reach the basket.

---

## A shared-ranking row opens (2026-09-17)

Carter: *"If you click on a coaster in the ranking list show everyone that has it in a list and
where they rank it."* He picked **expand in place** over a separate page. It runs on both
shared lists — the **Shared favorites** ten on `/rankings` and the full list on
`/rankings/all` — and on neither per-rider list, where the question has no answer: one person's
list is one person's opinion.

On `/rankings/all` the tally already carried `who` for the one-line teaser under each coaster;
it now carries the slug too, so each name in the opened panel links straight to that rider's own
rankings. `/rankings` counted lists without recording who was on them, so its tally grows the
same `who` array. The summary row there stays teaser-free — it is the tighter of the two by
design, and opening it is the payoff.

Shape, and why:

- `.srow` is only the card now — background, border, `overflow:hidden` so the opened panel is
  clipped to the rounded corners. The **flex row moved to `.stog`**, a `<button>` wrapping the
  whole row, because the entire row is the target and a button is what a keyboard and a screen
  reader expect. It resets every button default (`background`, `border`, `color`, `font`,
  `text-align`, `padding`) — miss one and it renders as a grey system button.
- **The rows toggle independently.** One-open-at-a-time would close the row you opened this one
  to compare against, which is the whole reason to open two.
- `aria-expanded` on the button is both the accessibility state and the styling hook: it spins
  the chevron and hides the teaser line (`.by`), which says the same thing the opened list says
  in full and only costs height once the panel is there.
- `:hover` is inside `@media (hover:hover)` — on a phone a hover background sticks to the last
  thing tapped and the row looks stuck open after you close it.
- Everything new is scoped under `.srow` on purpose: `.who` is already a class in `style.css`
  under `.riderrow` and `.profedit`. Same lesson as every other specificity trap in CLAUDE.md —
  grep before you name.

Tested in the harness at desktop and 390px, dark and light, on both pages: opens, closes, two
rows open at once, names link to `/user/<slug>/rankings`, no horizontal overflow on a phone.

### The closed row, tightened (2026-09-17)

Carter, from a phone screenshot: *"Don't show rankings from people until we click on it … park /
location then model on the line below … tighten pull size around the text and narrow space
between pills so you can fit more coasters per page. On desktop keep location and model on the
same line."* So:

- **The teaser is gone**, on both lists. It was clipped after two names on a phone — "Firepheonix
  #1 · Keltan Kemp #…" — which is the shape of an answer without being one. Opening the row is
  the answer now.
- **`.pl` (park · region) and `.mk` (model)** replace the anonymous `<span>` inside `.n`, wrapped
  in `.sub`. One line on desktop, joined by a `::before` separator on `.mk`; under 560px `.mk`
  becomes a block and the separator goes. Write that separator as a **literal `·`**: CSS eats the
  whitespace that terminates a hex escape, so `content:" \00b7 "` loses the space after the dot.
- **Tighter:** card gap 8→6px, row padding 11/14→9/12px (8/11 on a phone), explicit line-heights.
  A phone row went 90px → 71px, five rows on the first screen instead of four.

The selectors are named for what they hold rather than for being a span inside `.n` — that row
has gained and lost spans three times now, and CLAUDE.md has the scars.

Then, from the next screenshot: **the count on the right is `align-self:center`**, along with
the chevron, whose `margin-top:4px` went with it. The left-hand side is two lines on a desktop
and three on a phone, and "3 lists / avg #1.3" has no reason to hang off whichever one comes
first.

The same `.sub` / `.pl` / `.mk` split now draws **every ranking row on the site**, not only the
shared ones: `.rrow` (the list you edit on `/user/<name>/rankings`) and `.trow` (the top ten on
a profile). Three copies of the same five rules, one per page's `<style>`, because each page
carries its own — if a fourth list ever wants it, that is the moment to move them into
`style.css` rather than paste them again.

---

## The copy desk, and the loading-line pool (2026-09-17)

Carter is rewriting the site's copy in an artifact — the **Coaster Hub Copy Desk**,
`https://claude.ai/artifact/DpmK3FrUXVCBpj5peW2Ekz`. Every user-visible string is a row:
what is live on the left, an autosaving textarea on the right. Rows save to the artifact's
`db` under collection `copy`, one doc per row, `{text, at}`. He fills it in whenever; a pass
happens when he asks, by reading that collection and editing the repo. **Never write to that
collection** — his text stays there after a pass so he can see what he asked for.

Two conventions he uses inside a replacement:

- **`[arrow]`** — keep the arrow. Becomes `→` (the "go do this" arrow the site ends links
  with). The two directional ones, `← Prev` / `Next →` on the count pager and `↗` on
  `/edit`, keep whichever they already have.
- **`[]`** on its own — delete that string from the site. Remove the whole element, not its
  text: an empty `<p>` still takes its margin and an empty `.badge` still draws a pill.

Row ids are `r-<group>-<row>-<slug of label + live text>`, so **changing a row's live text in
`DATA` orphans whatever he typed against it**. That is why the left column still shows the
old copy for rows already applied — leave it alone.

**First pass (2026-09-17):** home h1, home badge, feedback heading and body, feed heading and
link; profile top-ten subtitles (both deleted), the Records / Rides over time / The breakdown
headings, the dead-link body, and the fallback headline.

**Second pass (2026-09-17):** the whole `/count` hero — both headlines, both subtitles, the
credits-only subtitle deleted — plus its hero button and the view switch (`Rides / Coaster list
/ Park list`); on `/rankings` both headlines, both subtitles, Shared favorites → **Master
list**, Each rider's list → **Personal lists** with new subtitles, and the card's drag hint.

**Third pass (2026-09-18):** the site-map headline and subtitle; on `/log` the sign-in body and
the add-credits hint; on `/import` the headline and subtitle; the signup password hint on
`/account`.

A later pass must skip all of those — their live text is no longer what the desk's left column
claims.

### The loading pool

The big line a hero wears before its numbers arrive is no longer a fixed word. `app.js` holds
one `LOADING` array for the whole site and swaps it into anything carrying **`data-loading`**:

- The heroes: `profile.html` `#hero_h`, `count.html`'s hero `h1`, `rankings.html` `#hero_h1`.
- The small lines under them: `#loading` on the profile, rankings and `/rankings/all`, and the
  feed's `.empty` on the home page and `/changes`.
- On `/rankings` (the everyone view) the headline is set synchronously, so the pool never shows
  in the hero there; on `/user/<slug>/rankings` it does, because that headline waits on a fetch.

The pool is **shuffled once per page load and dealt out in document order**, not picked afresh
per element. A profile has a hero line and a smaller one below it, and independent picks would
sometimes print the same phrase twice on one screen — which reads as a bug rather than a joke.

The swap runs **as `app.js` executes**, not on `DOMContentLoaded`: app.js is a blocking
`<script>` at the end of `<body>`, so it lands before the hero is painted. On
`DOMContentLoaded` you would see the markup's line and then watch it change.

Carter writes the list in the desk's **Loading lines** section — one phrase per line, saved as
the single doc `copy/pool-loading`. It is a pool, not a replacement: whatever he types there is
the whole list, so applying it means replacing `LOADING` in `app.js` wholesale. As of the second
pass it is his six: Credit whoring, Reriding, Getting in line, Ropedropping, Counting rides,
Tracking stats.

**The ellipsis is not his to type.** He wrote the six bare, following the textarea's
placeholder, and then asked for ellipses; rather than editing his words, `LOADING` appends one
(stripping any trailing `.` or `…` first, so a line typed with one does not end up with two). A
line in the desk reads `Reriding` and the page shows `Reriding…`, which keeps the desk the
source of truth and means the next pass can paste his list in unchanged.

Four loading lines are deliberately **out** of the pool, because they name what is on its way
rather than greeting you: `Loading riders…` on the home page, `Loading rides…` and
`Loading the full list…` on `/count`, and `Loading database…` on `/database`. Replacing those
with a random phrase would lose what they are telling you.

---

## Filtering Add coasters (2026-09-17)

Carter, on the picker inside a ranking's **Add coasters** tab: filter by park or
manufacturer; make the search box find a maker; and give the makers a panel showing his most
common with how many are left to place — *"Vekoma 10/50 unranked … then you can click on those
rows"* — as checkboxes, so he can look at every GCI, CCI and RMC at once, with a Clear. Then:
*"do the same thing for location"*, which is why the panel is a **facet** and not a
manufacturer widget.

Four pieces, all in `rankings.html`:

- **The search box reads more.** The haystack is now name + park + **manufacturer + model**, so
  typing `Vekoma` or `Raptor` turns up the coasters without opening anything.
- **A park `<select>`**, built from what is actually in scope with a count per park
  (`Cedar Point (82)`). Rebuilt when *Search all coasters* flips, keeping the current pick if it
  survives — refilling a `<select>` drops its value silently and re-picking the same option
  fires no `change`, which is the trap `/log` already documents.
- **Facet panels** — **Manufacturers** and **Locations** — each opened from a button that wears
  its number of ticks. `FACETS` is a list of `{id, label, sel, key}`; everything else
  (`facetRows`, `renderFacet`, the pool filter, the wiring) loops over it, so a third facet is
  a key function and two `<div>`s, not another copy of the machinery. Element ids are derived
  from the `id`: `<id>panel`, `<id>list`, `<id>note`, `<id>_clear`, `<id>_toggle`.
  Each row is a `<label>` — the whole row is the hit target — with a checkbox, the name, and
  `<left>/<total> unranked`. Sorted by **total descending**, because the one you have ridden
  most is the one you came to find. Two things sink below that, in order: **a row with nothing
  left** (`B&M 0/55` was riding second on its size alone, above every maker that still had
  coasters to place — the row stays, since `0/55` is an answer, but it stops holding the top),
  and then `Unknown`, which is a gap in the data rather than an answer. Unknown sits *below* the
  sink, not above it: an Unknown you still have coasters under is worth more than a maker you
  have finished. A finished row is muted as well as sunk.
- **One panel open at a time** — two of them push the list off the screen. The button keeps its
  highlight while its ticks are set, so closing a panel never hides that it is still filtering.
- **Ticks inside a panel widen, panels narrow each other**: Vekoma OR Intamin, but a Vekoma IN
  Ohio. That is the way round you would say it out loud, and it is what makes two panels worth
  having.
- **Clear**, one per panel, disabled until something is ticked, empties that panel's ticks and
  nothing else. The park select and the search box have their own obvious ways back.

The counts come from `scoped()` — scope plus the park filter — and deliberately **not** from
the finished pool. Applying a panel's ticks to its own counts would hide every row not yet
picked, and applying the search box would collapse a panel out from under you as you typed a
maker's name into it. A ticked row that the park filter leaves empty still appears, so an empty
result reads as "none here" rather than as a bug, and the list below says "Nothing unranked
matches those filters" rather than "Nothing left to add".

---

## The /log coaster rows (2026-09-17)

Carter: *"Take out wood/steel replace with model and squeeze in status somewhere?
(Operating/defunct). Auto sort defunct to the bottom."*

- **Model replaces the type.** `Steel` / `Wood` was the same word on nearly every row in a park;
  the model is the half worth reading. Same `CoasterHub.maker()` every other list uses, so it
  falls back to the manufacturer when there is no model.
- **The park drops out when a park is picked.** That was the other half of "squeeze in": picking
  a park already writes its name across the top of the panel, so repeating it on all nine rows
  was the line's cheapest tenant. Searching spans every park, so there it stays.
- **The status is the flag /count already uses**, down to the colours — a coloured word, and a
  coloured dot under 560px where a phone has no room for one. Nothing is drawn when neither a
  closing nor an opening date is known, the same rule `life()` follows on `/count`.
- **A row with neither a model nor a date gets no second line at all**, rather than an empty one
  that still takes its height.
- **Defunct sinks**, by `byLife` (closed last, then A–Z). In search mode the sort runs **before**
  the 200-row slice, so a query full of closed rides cannot eat the cap.

The list-mode float of what you have *not* got stays **outside** the defunct sink: a closed
coaster you have never logged is still one you can tick, and an operating one you already hold
is not. `Array.sort` is stable, so that second pass keeps defunct-last inside each half.

---

## /database wears the site's header (2026-09-18)

It had a one-off `Coaster database — QC` wordmark and read as a different website. It now uses
the same mark and **Coaster Hub** lockup as every other page, with **Edit** on the right (one
word, not "Edit the list →": the corner has to hold the account controls too) and the same
theme-toggle-plus-avatar corner.

`initNav` was the only way to get that corner, and it brings the whole site nav and the mobile
tab bar with it. So the pair is split out as **`CoasterHub.accountCorner(host)`** — `initNav`
calls it, and a page with its own header calls it directly. `/database` loads `app.js` purely
for that.

The bar is one line at every width: brand, Edit, toggle, avatar. It briefly wrapped on a phone
when it also carried a "Database" tag and the longer link — 454px of content on a 390px screen,
scrolling the whole page sideways. Both are gone; the lead paragraph under the bar already says
what the page is.

---

## Dragging to the bottom of a ranking (2026-09-18)

Carter, on a phone: *"when I drag a coaster to the bottom it doesn't go down fast enough."*

**The cause was not the speed.** `style.css` has `html{scroll-behavior:smooth}`, so every
`window.scrollBy` in `edgeScroll` was an *animation* — and asking for a new one on each of
sixty frames a second replaced each before it had travelled. Measured in the harness: 5,531px
requested over two seconds, **70px** delivered. `behavior:'instant'` is the fix, and it is now
in CLAUDE.md because it applies to any scroll the code drives itself.

Three things were wrong with the ramp as well, and they are worth keeping separate:

- **Pixels per second, not per frame.** The old `MAX=22` per frame meant a 120Hz phone scrolled
  twice as fast as a 60Hz one for exactly the same gesture.
- **An eased ramp** (`depth²`), so entering the band is gentle and the rim is quick, rather than
  linear across the whole 80px.
- **Wind-up**: holding at the edge accelerates to 2.4× over 1.1s, the way a native list does. A
  constant speed is what makes a long list feel unreachable.

The band is also wider on a touch screen (130px vs 90px) — a thumb cannot get as close to the
edge of a phone as a pointer can — and the sub-pixel remainder is carried between frames so a
slow crawl near the top of the band still moves instead of rounding to nothing.

Measured after, 60 rows on a 390px phone: **0 → 4,135px (the bottom) in under two seconds**,
against 370px in three seconds before. Held 110px into the band it still creeps at ~84px/s, so
fine placement survives. Up works the same, ~2,800px/s at the rim.

One trap for whoever tests this next: `scrollTo` is animated too, so a test that sets a scroll
position and immediately reads `pageYOffset` reads the middle of an animation. That sent me
chasing a phantom "upward drag scrolls the wrong way" for a while — it was the test.

---

## Clone groups (2026-09-18)

Carter: *"similar coasters stored together — Batman clones is one item but would take up
110-120 in my rankings."* Answering one question instead of eleven, without lying about how
many positions the family holds.

**The decision that shapes everything else: a ranking is still a flat list of coaster ids.**
`ORDER` is untouched, so positions, `/rankings/all`, the 2+ averages and "N ranked" all keep
working and none of them has to know groups exist. A group only decides how the *editor*
presents a contiguous run of that list.

### Where the definition lives

Shared, curated in `/edit`, admin-only (Carter's call). "These five are the same ride" is a fact
about the coasters, not an opinion about them, so it is stored with the coaster data and every
rider's list can collapse the same families. `migrations/012-clone-groups.sql`:
`clone_groups(id,name,note,created)` and `clone_members(coaster PRIMARY KEY, group_id)` — the
primary key on `coaster` alone is what makes "one group per coaster" a failed insert rather than
a coaster quietly in two families. No foreign keys (D1 has them off), so deleting a group has to
clear its members in the same breath; the Worker does both.

### Why it is curated and not computed

Neither obvious rule works, and the data says so:

- **Name alone**: "Batman: The Ride" is a B&M Invert, a FreeSpin *and* an SLC. "Goliath" spans
  five models.
- **Model alone**: "B&M Invert" is 19 coasters — Batman, Raptor, Montu, Afterburn. "Kiddie" is 43.
- **Name + model** is the honest signal: 30 families, 75 coasters. `suggestClones()` proposes
  exactly those, skipping anything already in a group, and Carter accepts or ignores each. It
  misses clones under different names (the SLCs, the Boomerangs), which is what hand-building in
  the Clones pane is for.

### The API

`GET /api/clones` is public and cacheable like `/api/coasters`; before the migration it answers
an empty list rather than a 503, because a ranking page that cannot collapse clones is just last
week's page. Every write 503s naming the file. `GET /api/admin/clones/suggest`, `POST
/api/clones`, `PUT|DELETE /api/clones/:id` are admin. A group needs a name and **two** members —
one coaster is not a family, and collapsing it would hide a row behind a disclosure for nothing.

### In the editor

`blocks()` folds a **contiguous** run of one group into a single `.rrow.grp`, numbered with the
span it holds (`3–7`), captioned with the note, and carrying `×5`. Move, drag and delete all act
on the block; the expander opens the members with their real positions and a × that drops just
one.

**Nothing is rearranged on load.** A family scattered through an existing ranking stays scattered
— silently hauling somebody's list about because a group was defined last night is not a thing a
page should do. Instead `scattered()` shows one bar offering **Gather them**, which pulls each
family to its best-placed member's position and leaves everything else alone.

### Not done yet

The **Add coasters** panel still lists a group's members as separate rows — ticking one adds one.
Adding a family as a block is the obvious next piece. The shared list also still counts each
clone separately, which is correct today (every coaster keeps its own position) but is the place
to look if "Batman: The Ride" should ever appear once on `/rankings/all`.

---

## Categories, designed in an artifact first (2026-09-18)

The clone-group code that shipped on 2026-09-18 was the *mechanism*. What it is going to look
like was worked out somewhere else entirely — a prototype published as a Claude artifact,
because the whole question is subjective and a screenshot beats an argument.

**The Batman Problem** — <https://claude.ai/artifact/FHbmGbCGi3SWos2VNPcGBH>
Carter's real rides, the real families the suggester finds, and Coaster Hub's own tokens, so a
judgement made there transfers. Twelve versions of back-and-forth. What came out of it:

- **One pill above the list**, reading `Categories 3` or a grey `Categories off`, and *nothing
  else*. Every word of explanation lives behind it. `/rankings` gains one row and no settings,
  and the pill shows for everybody — it is the only way anyone finds out the feature exists.
- **A categories screen** behind the pill: a master checkbox next to the word, how-it-works,
  your categories (each with its own tick, a pencil, and an expander for adding and removing
  rides), the suggester's output with a `+`, and how to write your own.
- **Unticking loses nothing.** A category you switch off puts its rides back as ordinary rows
  in the order you left them; ticking it again brings your order back. This is the promise the
  whole design rests on, and it is only keepable because a ranking stays a flat list of ids.
- **`~` instead of numbers** while a category is on *Same rank*. The rides still hold an order
  underneath and can still be reordered — only the numbers are hidden. Default is off:
  the point of a category is that you did not want to argue about which Batman was 113th.
- **A pulled-out ride** is listed under its category as `Six Flags Great America (+3)` —
  green above the category, red below, counted from the category's own block.
- **A ride that leaves a live run gets moved next to it.** Without that, pulling a ride out of
  the middle splits the category into two rows with the same name. Same for setting one aside,
  and the reverse when one joins.
- Vocabulary is **category** everywhere a reader sees it, except the label inside an open row,
  which Carter chose himself: **In this group**.

### Two traps the prototype caught, both of which apply to the real pages

- **`flex: 0 0 100%` is not 100%.** `min-width` defaults to `auto`, so a panel that is wide at
  its narrowest refuses to shrink and drags its right-hand controls past the card's edge. It
  needs `min-width: 0` as well. This is what put a button outside its own card on a phone.
- **`↩` and `↗` are emoji.** U+21A9 renders as a blue tile in iOS WebKit, and U+2197's text
  form comes out a hairline next to a drawn icon. Both are inline SVG now, like the pencil.
  `↑` and `↓` are safe.

### The premade categories are Carter's to write

**Category Desk** — <https://claude.ai/artifact/DFR3LQkedD5PbRPYtkQpfQ>
An artifact with the `db` capability holding one document per category
(`cats/<slug>` = `{name, note, why, status, members[], updated}`), so the work survives and can
be read back with `ArtifactData` to generate the migration. It carries the whole of
`coasters.json` flattened to index arrays (1,114 rows, 44KB), the 30 name+model families as
suggestions, and a picker that filters by model.

**Why a person has to write these:** 545 of the 1,114 coasters carry **no model at all**, so
name+model finds 30 families over 75 coasters and can never find more. The twelve Suspended
Looping Coasters are called Batman: The Ride, Condor, DareDeviler, Kong, Mind Eraser, Vampire
and six other things. Do not offer to generate the list — it was explicitly asked for as his
job, and the taste is the whole point.

### Still dormant

`migrations/012-clone-groups.sql` is **not run**. The clone code on `main` stays dormant, and
the commitment stands: **purge it when the real category feature lands** rather than growing a
second system beside it.

---

### The editor already exists; the mark and the first run (2026-09-18)

**`/edit` → Categories** is the admin editor, and it has been since the clone code landed
— accept a suggestion, rename it, tick members off, search for more, Save, Delete. It was
called "Clones" and it is called Categories now. Driven end to end against the real worker
with `node:sqlite`: accept, rename, save, and `/api/clones` returns the group with its five
members. **The only thing it needs is `migrations/012-clone-groups.sql` pasted into the D1
console.** Before that it 503s naming the file, which is the rule for this repo.

**The mark.** A **Coaster Hub category** — one Carter wrote in `/edit` — carries a
small teal check-in-a-circle after its name. One a rider invented carries nothing. Marking
the preset is the right way round: the fact worth showing is "Max has this one too", and a
category you made yourself is just your list. Not a star (reads as favourite) and not a lock
(nothing is locked — your copy of a preset is yours to rename, trim and pull rides out of).

**The first time somebody ranks.** Two moments, both offers, neither of them a tour:

1. **Building a list a ride at a time** — nothing happens until they place the SECOND
   member of a preset. Then one card where the row would go: *Same ride, twice. You just
   ranked Batman: The Ride at Six Flags Great Adventure. You already have the one at Six
   Flags Great America — and there are three more you have been on.* Make them one row /
   Keep them separate.
2. **A whole count arriving at once** (an import, which is how Sean, Max and Cole arrive)
   — one bar at the top of the ranking: *6 sets of the same ride. 23 of your rides are
   the same ride at different parks. They could be 6 rows.* Review them / Not now.

Answering once sets the default: yes and the next pair folds on its own with a quiet
**Boomerang grouped — undo**; no and the feature goes off, the offer never returns and
only the grey pill remains. Only Coaster Hub categories are ever offered — a rider's own
are never suggested to anybody, including them. And it still never rearranges an existing
list.

**Not built yet: per-rider categories.** Everything above assumes a rider can make their own,
which needs its own table and endpoints. `clone_groups` is the shared set only. When that
lands, `/api/clones` should mark which set a category came from rather than the page guessing.

---

### A rider's own categories, and the rule that keeps them simple (2026-09-18)

`migrations/013-rider-categories.sql` — three tables. `rider_categories` and
`rider_category_members` (a coaster in at most one of a rider's, enforced by the primary key,
the same way `clone_members` does it), and `category_prefs`, one JSON blob per rider:
`{"on":true,"off":["c1","r7"],"nums":["c2"]}`. `c1` is `clone_groups` id 1 and `r7` is
`rider_categories` id 7 — two id spaces that would collide the moment a rider's third
category met the site's third, so every preference is keyed by that string.

A blob rather than rows because **nothing queries across riders' preferences**: the ranking
page reads one rider's and writes one rider's. `rankings` is rows because the shared list
JOINs them; this does not.

**THE RULE (Carter, 2026-09-18): a rider cannot build their own category out of coasters that
are in one of the site's.** Not "should not" — the Worker refuses it with a 409 naming the
ride and its park. Forking "Batman: The Ride" into a private near-copy means two definitions
of the same thing, a merge every time the site's changes, and no answer to "have you been on
more Batmans than me". Don't want the site's? Switch it off and those rides are ordinary rows
again. Switching it off does **not** then free them to be rebuilt as your own — that is
the same fork by another route, and there is a test for it.

What a rider may do to one of the site's categories: **switch it off**, and **pull single
rides out of it in their ranking** (the `(+3)` / `(−2)` design). Neither of those changes
the definition, which is why both are fine.

### The API

    GET    /api/categories/:slug          public, like a ranking
    PUT    /api/categories/:slug/prefs    on/off + which show numbers
    POST   /api/categories/:slug          make one of your own
    PUT    /api/categories/:slug/:id      replace one of your own
    DELETE /api/categories/:slug/:id      delete one of your own
    GET    /api/admin/categories          what riders have built (admin, read only)

The read returns **one flat `categories` array**, the site's and the rider's together, each
carrying `official`, `off` and `nums`. The page should not have to know there are two tables;
it does need to know which is which, because an official one wears the mark.

Writes use **the ranking gate, not the admin gate**: once a rider has claimed their page, only
they write their categories — no admin override, by the same 2026-09-15 call that put
rankings out of Carter's reach. Someone else's category id is a **404, not a 403**: there is
nothing to learn from the difference.

`/api/admin/categories` is not a moderation tool, it is a **source**. It counts how many
different riders wrote a category by the same name, and `/edit` shows it as `Wacky Worms
×2 riders`. Two riders writing the same one by hand is the strongest case there is for
making it a Coaster Hub category, and nothing else on the site would ever say so.

### A bug this turned up: the base schema had `rankings` wrong

`migrations/000-base-schema.sql` and `tools/dev-server.mjs` both declared
`rankings(user_slug PRIMARY KEY, ord TEXT, updated TEXT)`. The Worker reads and writes
`rankings(user_slug, coaster_id, pos)`. Both are mine, from the session that wrote 000, and
the effect was that **`/rankings` 500ed on the dev server** and a staging database built by
following STAGING.md would have had no working rankings at all. The test harness had it right,
which is why 394 tests passed over it. Both files now match the harness, primary key
`(user_slug, coaster_id)` — which is also what stops one coaster appearing twice in a list.

If a schema has to be written down in more than one place again, make the test harness read it
from the file rather than restating it.

### Next: the /rankings UI

The API and the editor exist; **the rider-facing UI does not**. What is needed is the artifact's
design ported onto `/rankings`: the Categories pill, the categories screen behind it, and
`renderRank()` folding on `getCategories()` instead of the dormant `CLONE` map. The folding
half already exists in `rankings.html` from the clone work — `blocks()`, `scattered()`,
`gather()`, the block-aware `move()`. Rewiring it to the new endpoint, with the mark and the
first-run offers, is the remaining piece.

---

### Making an account reaches /changes (2026-09-18)

Signing up already recorded `user_added` — "Wren joined" — because the rider row is new.
**Claiming an invite records no rider**, so it recorded nothing at all, and somebody taking
ownership of the page that has been about them for months went by in silence. Sean claimed his
on 2026-09-18 and the feed never mentioned it.

New kind **`claimed`**: "Cole created an account /user/cole", with a person-and-tick icon, in
the Riders feed beside `user_added`. `migrations/014-claimed-accounts.sql` backfills one row
per existing account, dated from `accounts.created` rather than from today, so the feed reads
in the order things happened. Guarded on the row not already existing, so it is safe to run
again.

### The dev server builds its schema from the migration files now

It used to write the tables out longhand, and that copy had drifted **four** times:

- `rankings` had the JSON `ord` column the Worker has never used — `/rankings` 500ed here.
- `sessions` had `account_id` where the Worker writes `account` — claiming an invite
  half-succeeded: the account row and the activity row were written, then `startSession` threw.
- `users` had no `created`, which `addUser()` writes — **signup 500ed**.
- (and `000-base-schema.sql`, which STAGING.md tells Carter to run on a fresh D1, had the same
  first and third bugs, so a staging database built by the book would have had neither working
  rankings nor working signup.)

All four were invisible because `tools/test-rides-api.mjs` carries a THIRD copy of the schema,
and that one is right. `tools/dev-server.mjs` now runs `000, 003, 007, 010, 012, 013, 014` from
`migrations/` — the order STAGING.md gives — twice each. A migration that is not
re-runnable, or that does not make the shape the Worker queries, now fails when the dev server
starts instead of in the D1 console.

**The harness is still a fourth copy.** It builds its tables inline because it wants a
deliberately minimal fixture, and it is the one that has never been wrong — but if a fifth
drift ever shows up, that is where to look next.

---

### What was actually slow, and what was just sitting there (2026-09-18)

Carter asked for a purge to speed the site up. Measured first, with the dev server and a
headless browser, and **dead code was not the problem** — nothing meaningful was dead, and
the Worker's own size costs a page nothing.

What every page loads, biggest first, is the same thing every time: **`/api/coasters`, 268 KB
decoded** (about 30 KB over the wire gzipped, `public, max-age=300`). Everything the site
writes itself — `app.js` 51 KB, `style.css` 36 KB — is a rounding error beside it.

**The home page asked for it twice**, because `index.html` fetches the coaster list and so does
`loadUser()`. 790 KB → **523 KB**, one fewer request. `fetchCoasters()` and `fetchParks()`
now share a promise **while a request is in flight** and drop it the moment it settles. That is
deliberate and the comment says so: `/add` and `/import` both fetch, write, and fetch again, and
a cache that outlived the request would show them the list from before their own edit.

**1.1 MB of artwork nothing links to** was being deployed and served: `logo-original.png` (1 MB
on its own), `logo.png`, `logo.svg`, `favicon-small.svg`. Nothing requested them, so no page was
ever slowed by them — they were just in the bundle. They are in `.assetsignore` now and
still in git; `logo-original.png` is the master the others were cut from. Delete a line to put
one back.

**And the notes were public.** `CLAUDE.md`, `README.md`, `STAGING.md`, `wrangler.staging.jsonc`
and `.gitignore` were all being served from coasterhub.org. `STAGING.md` explains what `DEV_AS`
does and where it lives — not a hole, since the variable is not set in production, but it is
internal reading on a public URL. All five are ignored now. `COASTERHUB_HANDOFF.md` already was.

**Kept, deliberately, after asking:** the staging kit (`wrangler.staging.jsonc`, `STAGING.md`,
`tools/staging-seed.mjs`) because beta-testing the categories UI with Max and Cole is still
ahead of us; every import tool in `tools/`, because that is how coasters get into the database;
and the static `<rider>.json` and `coasters.json` files, which are the API's fallback, the dev
server's seed and the migration dry-run source all at once.

**If more speed is ever wanted**, the honest next move is a slimmer `/api/coasters` for pages
that only need `id, name, park, model`, keeping the full one for `/count` and `/edit`. It was
left alone because it touches `computeStats()`, and a broken stat is the kind of thing nobody
notices for a week.

---

### /edit read its own writes from cache (2026-09-18)

Carter saved a category with a ride he had just ticked, and the ride did not appear in the
members list. The save was fine — the server had it. **The re-read came out of the browser
cache.**

`/api/clones`, `/api/coasters` and `/api/parks` are sent with `public, max-age=300`, which is
right for a reader and wrong for the page that just changed them. So `loadClones()` got the
copy from before the save, the toast said "Saved", and the editor showed the old list for up to
five minutes. `api()` in `edit.html` passes **`cache: "no-store"`** now.

This is the same family as the avatar that came back wearing its owner's previous picture
(CLAUDE.md, JSON_HEADERS). The rule there was about endpoints that forgot to say anything;
this is the other half: **an endpoint that correctly asks to be cached still has one caller who
must never get the cached copy — the editor that writes it.** Any future admin page that
reads a `LIST_CACHE` endpoint after writing to it needs the same.

### The rest of that pass

- **`+ New category`** in the toolbar. Accepting a suggestion only ever gets the 30 families a
  name+model match can find; the ones worth having — every SLC, every Wacky Worm — are
  named differently at every park and can only be built by hand. Same editor with nothing in
  it, no Delete button until it exists, POST instead of PUT.
- **Saving reopens the category from fresh data**, so a ride ticked out of the search results
  appears where it now lives: in Members, at the top. Accepting a suggestion opens what it just
  made rather than leaving you on the suggestion you have answered. Deleting clears the editor.
- **The left list has real dividers.** `LIVE ON THE SITE` in the accent colour at the top, then
  `RIDERS' OWN` and `SUGGESTED · NOT LIVE` as sticky grey headers with a heavy top border.
  Before this, "Suggested" was just another row and there was no way to see where live stopped.
  The open category carries `.sel`.

---

### The members list is the truth (2026-09-18)

Sorting the rides in a category by name was the ask; the rest followed from Carter's next
sentence — *"when something's in the list make it not come up in search"*.

- **Sorted by name, then park.** Within a clone family every name is identical, so the park is
  what actually separates them; a hand-built category (every SLC) is the other way round. Both
  keys, in that order. The members list and the search results use the same comparator.
- **Search cannot offer a ride the category already has.** It is filtered out.
- **A ride you tick moves straight up into Members**, marked `· new` until saved. The
  `extra` array is gone: it let a ride be ticked below and absent above at the same time, and a
  save could send something the page was not showing. Now `#cgmem` IS what gets saved.
- **A ride in a DIFFERENT category is shown, disabled, "already in Batman: The Ride"** —
  not hidden. The API refuses it on save anyway, and a ride that silently never appears in
  search leaves you wondering; naming the category that holds it answers the question.
- **The row you tick stays where it is**, ticked and dead, instead of being pulled out of the
  list. With six Goliaths on screen, a list that reflows on every tick is a mis-tap waiting to
  happen on a phone. The exclusion happens on the NEXT search, which is where it belongs.

Found while testing: Playwright's `check()` fights a list that re-renders under it — it
clicks, asserts, finds the element gone, resolves `.first()` to the NEXT row and clicks that
too, six times over. Use `click()` for anything that removes itself.

---

### Categories, live on /rankings (2026-09-18)

The artifact's design, on the real page. `/user/<slug>/rankings` reads
**`GET /api/categories/<slug>`** now instead of `/api/clones`, and `CLONE[id]` is the category
a coaster folds into **right now** — a category switched off, or a ride pulled out of one,
is simply absent from that map and every drawing rule below needs to know nothing else.

Open a category row and you get, in the row itself:

- **Same rank / Numbered**, per category. Default `~`. The rides do not move either way, only
  what the column says, so an order set under `~` survives the switch.
- **↑ ↓ inside the category.** Members are contiguous in ORDER, so it is the same swap
  the whole list does — the flat list stays flat, which is what keeps every position honest.
- **↗ pull one out.** It stays IN the category (that is what lets the panel say where it
  went) and stops folding into it.
- **Reset order** — back to alphabetical by park then name, the order the category is
  stored in.
- **Ranked separately: Six Flags Great America (−1)**, green above the category and red
  below, counted from the category's own block — and **Pull all back in**, which was
  Carter's. Both new this pass; the rest came from the artifact.

`snug()` is load-bearing: a ride that stops folding moves next to the category's remaining run
rather than staying put. Without it, pulling one out of the MIDDLE splits the category into two
rows with the same name.

**`pulled` is stored, not inferred.** It lives in `category_prefs` beside `on`, `off` and
`nums`. "Not next to the others" and "deliberately somewhere else" are different things, and
only the second should survive a drag that happens to land next to the family again.

**Two writes, one button.** Save PUTs the order, and then — only once that has succeeded
— PUTs the preferences. The order is the one that matters; preferences are how the same
list is *drawn*, so a failure there is worth a line and never worth losing the save that
already worked.

The `--up` / `--down` colours are defined on `.rrow` in `rankings.html` rather than in
`style.css`: the site has no green, this is the only page that draws them, and `style.css` is
CRLF and not worth opening for two lines.

### Category events read like sentences now (2026-09-18)

`/changes` was showing a raw `clone_set` per save — twelve identical rows for one
afternoon. Now:

> **Wacky Worms** category created and modified
> **Batman clones** category created

A create records `detail: {made: true}`; an edit records nothing, which also makes every row
already in the table read as "modified" without a migration. `groupRuns` chains them within the
hour like ranking and credits bursts, but on the **subject** rather than the actor — the
actor on an admin write is nobody. `BY_SUBJECT` in `changes-feed.js` is that switch. A run that
contains the create says "created and modified"; `clone_removed` says "category deleted". Both
get a layers icon.

---

### /categories — every rider's own page (2026-09-18)

The settings screen from the artifact, made real. `CoasterHub.me()` for the slug, then
`/api/categories/<slug>` — the API already handed the site's and the rider's own back as
**one list with `official` on each**, so the page never has to know there are two tables.

- **Use categories** — the master switch, a real checkbox next to the words, in a card that
  lights up when on.
- **Coaster Hub categories** — all of Carter's, each with a tick, the seal, and
  **"5 of 5 ridden"**. Sorted by how much of it you have actually been on, and the ones where
  that is 0 or 1 sit behind *"Show N more you have barely ridden"*: a category of five Batmans
  is worth nothing to somebody who has ridden one, and the row should say so rather than let
  them wonder why their list did not change. Open one and you see its rides, with the ones you
  have not ridden greyed and labelled. **You cannot edit its members** — the card says why.
- **Your own** — create, rename, add a ride, take one out, delete. The picker searches
  **your count**, not the database: a category is about rides you have been on, and 1,114 rows
  is not a list anybody scrolls. A ride the site already groups comes back disabled and
  labelled with the category holding it, which is the 409 the API would return anyway, said
  before you press the button.
- Taking a ride out of one of yours is refused client-side below two members, with "delete it
  instead" — the same rule the API enforces, in words.

Every change writes immediately: this is a settings page, not a document, so there is no Save
button. `pulled` is carried through the prefs PUT untouched — it is set on the ranking page
and this page has no business moving where somebody ranked something.

**The way in** is a `Categories 3` pill above the ranking list (grey `off` when the master
switch is off), and a footer link on all eleven pages. `/categories` resolves to
`categories.html` through Cloudflare's own extensionless mapping, so it needed no route.

### Two notes that were wrong

- **The CRLF list in CLAUDE.md named `index.html` and `stats.html`.** `index.html` is LF and
  has been since before this session; `stats.html` does not exist any more. The real list is
  `README.md`, `style.css`, `tools/import-credits.js`. Check with
  `git show HEAD:<file> | grep -c $'\r'` rather than trusting the note.
- A **full-page screenshot draws a `position:fixed` bar wherever the scroll happens to be**, so
  the mobile tab bar appeared to be sitting on top of the page's own content. Measured instead:
  the content ends at 604px and the bar starts at 793px. Measure before believing a full-page
  screenshot about anything fixed.

### Next: choosing a category while you rank

Not built. The moment that matters is placing the FIRST member of a category into a list that
has none of it yet: *"Batman: The Ride is one of 5 in a category. Put the whole group here?"*,
defaulting to **not numbered**. Carter's words, 2026-09-18. The second moment — a whole
count arriving at once — is the bar described under "the first time somebody ranks" above.

---

### Add coasters folds too (2026-09-18)

The gap the clone work left open, closed. **Five Batmans you have not ranked are one decision,
not five**, and adding them one at a time is exactly the work a category exists to save.

The pool folds the same way the ranking does. A live category with **two or more** members still
unranked becomes one row — `Batman: The Ride ×5`, in the same wash and with the same
count badge it will wear once it lands — and:

- **Add 5** appends them together and contiguously, so they are already one row by the time you
  look at the list.
- **Rank** compares ONE of them against your list (placing five identical rides by comparison
  would be the same question five times) and the rest follow it into the spot it won. `openHH`
  takes a `mates` array now and splices them in behind the winner.

One left is not a family, it is a coaster, and it reads better as itself. The facets narrow a
group with everything else, so a Vekoma filter over five Batmans says three.

The count line counts COASTERS and says the rest: *"559 of your coasters not ranked yet · 9
of them in 2 categories — showing the first 300 rows"*. It used to compare rows against
coasters and claim it was truncating when it was not.

### A pre-existing bug found while measuring

**`/rankings` scrolled sideways on a phone, and had nothing to do with categories.** A bare
`<select>` sizes to its widest OPTION unless told otherwise, and the park filter holds
"St. Louis's Incredible Pizza Company": 412px wide inside a 400px viewport. `select{max-width:100%}`.

The only reason this turned up is that the browser check measures
`scrollWidth - clientWidth` on every run. Keep doing that — it costs one line and it found a
bug nobody had reported on the most-used page on the site.

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

### The headline number is the DATABASE, not what has been ridden (2026-09-15)

The home headline and `/rides` → Full list disagreed by one (1,114 vs 1,115): the headline was
the union of coasters someone had ridden, the full list was every row in the `coasters` table.
`/add` lets a coaster exist before anyone logs it ("Stats can come later"), so the gap is
however many are waiting for their first ride.

**Carter's call: both show the database count.** The headline is `coasters.length`, the full
list is unfiltered, and adding a coaster on `/add` moves the headline before anybody has ridden
it. That is the intended behaviour, not a bug to re-fix — a previous pass made both the ridden
union instead and it was reverted the same day.

The ridden union is no longer displayed anywhere. It is one line to bring back
(`Object.keys(st.byCoaster)` unioned across riders, which is what `index.html` used to do) if a
"N ridden" figure is ever wanted alongside it. A `GET /api/ridden` endpoint existed briefly for
the same purpose and was removed with it, rather than left as an endpoint nothing reads.

Independently of all that: `forEveryone()` in `rides.html` was fetching `/coasters.json`
directly instead of going through `fetchCoasters()`, so that one view read the static snapshot
and was stale between syncs while every other page tried the API first. That fix stayed.

### Ranking a coaster credits it (2026-09-14)

`putRankings()` gives the rider an undated ride row for every coaster they have ranked but
have no rides row for (`creditRanked()`). Nobody ranks a ride they have not been on, and
before this the two lists could disagree — a new account could rank twenty coasters and still
show a count of zero, which is exactly what the first open sign-up looked like.

**It only ever adds.** Un-ranking does not delete the credit, and clearing a whole ranking
removes nothing. Dropping a coaster off your favorites says something about the ranking, not
about whether you rode it, and no reorder should be able to destroy ride history. Removing a
credit stays an explicit act on `/log`.

Rows are undated because a ranking carries no date — the same shape as ticking a coaster off a
list. It is idempotent (`INSERT ... WHERE NOT EXISTS`), so re-saving credits nothing twice, and
chunked by `SQL_VARS` like every other id list here. The count rides along inside the existing
`ranking` activity entry (`detail.credited`) rather than as a second feed row: one action by the
rider should read as one line.

**A claimed rider's ranking has NO admin override** (2026-09-15) — the only write on the site
that does not. Carter's call, on finding he could reorder someone else's favorites. Everywhere
else an override earns its keep because the data can be wrong and need repairing: a mistyped
ride, a merged coaster, a park in the wrong place. A ranking cannot be wrong. It is one
person's opinion of what they enjoyed, and no support request ends in someone else reordering
it. Neither `ADMIN_PASSWORD` nor an `is_admin` account opens it; D1 remains the escape hatch if
a list ever genuinely has to be repaired.

`GET /api/rankings/<slug>` returns `claimed` so the page knows before it offers anything:
viewing someone else's list hides the drag handles, the row controls, Add coasters and Save,
and says whose list it is. An unclaimed rider stays editable by anyone, which is still how the
riders who predate accounts manage their own.

**Ranking while signed out.** Rankings are still unchallenged for an unclaimed rider, but once
a rider claims an account only that account may write their order — so a signed-out rider can
rank happily and then fail to save. `/rankings` turns that 401 into a sign-in link that returns
to the page (`?next=`), with their order still on screen, rather than printing "unauthorized".
The save also reports credits gained ("Saved · 40 ranked · +3 credits") so a count moving is
visible where it happened.

**Backfill.** The live path only credits when a ranking is next saved, so anything ranked
before the deploy stayed missing. `migrations/006-backfill-ranked-credits.sql` closes that once
for existing rankings — undated, idempotent, insert-only, and it writes no activity row (it is a
correction to data that was already there, not something a rider did). It applies to EVERY
rider, so the preview query at the top of the file is worth running first: a large number
against one of the original four would mean their public count is about to jump.

### 3. Accounts — **built 2026-09-14**

Riders sign in as themselves. `ADMIN_PASSWORD` still exists and still opens everything; what
accounts add is **identity**, so the ride and ranking routes can tell whose count is being
written to. Tables: `accounts`, `sessions`, `invites` (`migrations/003-accounts.sql`).

**The write split, which is the whole point:**

| Write | Who |
|---|---|
| Your own rides and credits | your account — or `ADMIN_PASSWORD`, still |
| Your own **rankings**, once claimed | **you alone.** No admin override at all — see below |
| Another rider's rides | `ADMIN_PASSWORD`, or an account with `is_admin` |
| **Adding** a coaster or a park (`/add`) | **any account** — see below |
| Editing, merging, deleting, adding riders (`/edit`, `/import`) | an `is_admin` account, or `ADMIN_PASSWORD` |

**Adding to the shared list is open to any account (2026-09-16, Carter's call).** A rider who
has just ridden something the site has never heard of is exactly who should be able to put it
on the list, and making them ask first is how a coaster list falls behind. `/add` lets any
signed-in account through its gate; signed out you get a sign-in link rather than a password
box (the password still works, tucked behind a `<summary>`).

Two routes are carved out of the blanket admin check in `worker.js` — `POST /api/coaster` and
`PUT /api/park` — and **only creating** is open. Editing what is already there stays admin,
because `/edit` rewrites rows every rider's count depends on and a bad merge is far harder to
spot than a duplicate row. `PUT /api/park` enforces that split inside the handler: for an
ordinary account the conflict clause is `DO NOTHING`, so adding a coaster to Cedar Point cannot
move Cedar Point; for an admin it stays the `COALESCE` update that `/edit` relies on.

**`ADMIN_PASSWORD` is no longer needed day to day (2026-09-15).** An admin account opens
everything it opened — `/add`, `/edit` and `/import` skip their password gate when an
`is_admin` account is signed in, and `adminOk()` accepts either. The account is the better
credential: it records who acted, it is revoked by changing one person's password, and there is
nothing to text anybody. The secret stays as break-glass and for scripts; **unsetting it
entirely is supported** — `tokenOk()` simply returns false and accounts become the only way in.
There is a test for that exact configuration.

- **Passwords** are PBKDF2-HMAC-SHA256 at **100000 iterations, which is the Workers ceiling**,
  with the salt and count stored in the hash string. Anything above 100000 is refused outright
  by the runtime (`iteration counts above 100000 are not supported`) — and Node's WebCrypto has
  no such limit, so `tools/test-rides-api.mjs` cannot catch it by running the code. It shipped
  at 210000 on 2026-09-14 and died on the first real sign-up; the suite now reads the constant
  out of the source and asserts the ceiling. **Do not "harden" this by raising the number** —
  stronger hashing needs a different KDF (scrypt/argon2 via wasm), not a bigger count.
- **Anything that can fail must fail before the first write.** `addUser()` creates a rider row
  and an activity entry, and D1 has no transaction across these statements, so sign-up hashes
  the password *first*: the 210000 bug left a stray unowned rider on the live site because the
  hash threw after the rider was created.
- **Sessions** are a 32-byte random token in an HttpOnly/Secure/SameSite=Lax cookie (`ch_sess`,
  90 days). The table stores its SHA-256, so a dump of `sessions` cannot be replayed as a login.
- **Sign-up is open to anyone** (Carter's call, 2026-09-14) and creates the rider it owns, so a
  stranger lands on an empty count of their own rather than anywhere near an existing one.
- **Rankings** stay open for a rider with no account — the friction that made them open in the
  first place is still real for an unclaimed rider — and close automatically the moment that
  rider is claimed. No rider is worse off than before; every claimed one is better off.

**Deploying it:** apply the migration before the Worker goes out, or every `/api/auth/*` call
500s on a missing table:

```bash
wrangler d1 execute coasterhub --remote --file=migrations/003-accounts.sql
```

**Claiming the five original riders.** Nothing about their rows moved. Each one needs a
one-time link:

```bash
curl -X POST https://coasterhub.org/api/admin/invite \
  -H "x-admin-token: $ADMIN_PASSWORD" -H 'content-type: application/json' \
  -d '{"slug":"cole"}'
# -> {"url":"https://coasterhub.org/account?claim=<code>"}
```

Send that link to the person. It is a bearer credential and single-use: whoever opens it sets
the email and password for that rider, once. An already-claimed rider cannot be re-invited.
Carter's own account wants `UPDATE accounts SET is_admin = 1 WHERE slug = 'carter';` afterwards —
there is no UI for that flag.

**Changing a username (2026-09-14).** `/account` → "Change your username". `users.slug` is a
public URL and an undeclared foreign key in five tables (`rides`, `rankings`, `accounts`,
`activity`, `invites`), so `renameRider()` moves all of them in one `batch()` — a half-applied
rename detaches a rider from their rides.

It is a **move, not a forward**. The old username is gone the moment it returns: `/user/<old>/`
404s, and the freed name can be taken by anyone, inheriting nothing but the name. Carter's call
after using the first cut, which kept a `user_aliases` row so old links survived (migration 004,
dropped again by 005 the same day). Coasters and parks still keep their aliases, and the
difference is worth holding on to: a coaster is renamed *by the world* and both names go on
meaning the same ride, whereas a person picking a new username is choosing to stop being
findable at the old one.

Because dead rider URLs are now an ordinary thing to land on, `fetchJSON()` in `app.js`
distinguishes "genuinely not there" (API 404 **and** no static snapshot → `err.missing`) from
"could not reach the data", and `/stats` prints "No rider called X" instead of the developer
advice about `python -m http.server` that every failure used to produce.

**Display name is editable** (added 2026-09-15, after a day without it). `POST
/api/account/profile` takes `name`, `username` and `bio` in any combination, each optional, so a
page can send only the field it changed. The three validate differently because they are
different things: free text, a public URL and a key in five tables, and a length-capped caption.
A display name is NOT unique — two riders called Dave are two riders called Dave, and the
username is what tells them apart.

**The editable card lives on your own profile page, not on /account** (2026-09-15). Carter's
call: one page for "you", rather than a profile page and an account page saying similar things.
`profile-edit.js` renders it, `stats.html` mounts it when the signed-in account owns the page,
and `/account` is signed-out only — sign in, sign up, claim an invite, reset a password. Signed
in, `/account` redirects to your profile, and the header avatar links there too.

**Every profile page gets the same identity block** — picture, name, username, bio — and
`mount()` takes `editable`. Yours renders them as buttons that open editors, with your email and
a Change password / Sign out row; a visitor gets the identical block as plain text, and the
editing machinery, the crop window and the email are never built at all rather than built and
hidden. An empty bio invites on your own page ("Add a short bio") and takes up no room on
someone else's.

**The `/stats` hero is two columns** (2026-09-15): the identity block on the left, the rider's
two numbers on the right — `561 coasters.` over `2,238 rides.`, with "Full credit list →" under
them. What went away: the `CARTER'S COUNT` badge and the "Every ride, park, and record from
Carter's coaster count — 2004 to 2026" blurb, both of which named the rider a second and third
time directly under a card that already says who they are. The badge and the blurb are still in
the markup because the hub (`/stats` with nobody in the URL) uses them; `render()` removes them
from the DOM and adds `.split` to `#herotop`, so a rider's page is the only one that gets the
right-hand column. The rides line is dropped entirely when `has.rideCounts` is false — `k.rides`
is null there, and "— rides." reads as a bug rather than as a rider whose re-rides aren't known.
Below 640px the two columns stack and the numbers go back to left-aligned, because right-aligned
numbers under a left-aligned name point in two directions.

Three CSS traps live here, all the same shape and all commented in place: `background`,
`font` and any other shorthand RESETS the longhands it covers, and `.profedit button.edit`
outranks `.profedit .av` / `.nm`. That combination silently ate the avatar circle once and the
display name's size once. Use `background-color` and `font-family`, not the shorthands.

Two things to know about the CSS: it is all scoped under `.profedit` in `style.css`, because a
bare `input{}` or `label{}` rule would reach into `/log`, `/add` and `/edit`, which style their
own forms. And `.profedit button.edit` is written `:not(.av)` — it is one element-selector more
specific than `.profedit .av`, so without that the reset strips the avatar circle of its
background and border and leaves a bare initial floating.

**Password reset — built 2026-09-15.** The Worker sends mail through **Resend** over plain
HTTPS (no SDK, which matters in a Worker). Two secrets:

| secret | what |
|---|---|
| `RESEND_API_KEY` | `re_...` from resend.com. **Without it reset is off and says so** — no silent pretending a link is coming. |
| `MAIL_FROM` | optional; defaults to `Coaster Hub <hello@coasterhub.org>`. Must be on a domain verified with Resend or every send is rejected. |

Setup, once: create the Resend account, add `coasterhub.org` as a domain, paste the DKIM/SPF
records it gives you into Cloudflare DNS, wait for it to verify, then
`wrangler secret put RESEND_API_KEY`. Apply `migrations/007-password-resets.sql` too — the
routes 503 with a clear message until it exists.

The flow: `POST /api/auth/forgot` → a link at `/account?reset=<token>`, good for **60 minutes
and one use**. Setting the password spends that link AND every other outstanding one for the
account (a stale email in an inbox must not stay a way in), deletes every session, and signs
the person in on the spot.

Two properties worth not breaking:

- **`/api/auth/forgot` answers identically whether or not the address has an account**, and the
  page prints the same sentence either way. Anything else tells a stranger which addresses are
  registered.
- **`resets.token` holds a SHA-256**, like `sessions`. A dump of the table cannot be turned
  back into a working link. Spent rows are kept, not deleted, so a second click gets "already
  been used" rather than the same answer as a forged token.

**Profiles — bio and picture (2026-09-15).** `migrations/008-profiles.sql` adds `users.bio`
(280 chars, a caption on a count rather than a second page of prose) and `users.avatar`.

`avatar` holds an **R2 object key**, not a URL and not bytes. The Worker serves it at
`/avatars/<key>` from the `AVATARS` binding, so pictures are on coasterhub.org and no third
party sees who is looking at whom. A fresh key is written on every upload and the old object is
deleted, which is what lets the response be cached `immutable` for a year — a cached picture
can never be the wrong picture.

**Cropping happens in the browser**, not the Worker: choosing a file opens a crop window (drag
to position, scroll/pinch/slider to zoom, with a circle drawn over the square viewport because
the avatar is round everywhere it appears). "Use this picture" renders the chosen region to a
256px canvas and sends ~30KB of JPEG; nothing is uploaded until then. The image is kept covering
the viewport, so a corner of empty background cannot be cropped. A Worker has no canvas, and
this also means a phone photo never travels at full size. The Worker still enforces type
(PNG/JPEG/WebP only — it is serving from our own origin) and a 512KB ceiling, because the
browser is not the only thing that can call the endpoint.

**Setup (done 2026-09-15):** bucket `coasterhub-avatars`, bound as `AVATARS`. It is NOT public
and has no custom domain — the Worker reads objects through the binding and serves them itself,
which is what keeps pictures on coasterhub.org and the bucket unenumerable. Note for any future
binding: do not commit one before the bucket exists, or the build fails, and main deploys on
push.

**Still to do, in rough order of how much it matters:**

1. **Nothing rate-limits `/api/auth/forgot`.** Someone can make the Worker send mail to any
   registered address repeatedly. The blast radius is small (the mail says "ignore this if it
   wasn't you" and nothing changes without the link) but it burns Resend quota and is rude to
   the recipient. A KV or Durable Object counter is the fix, and the same applies to `/login`.
2. **No rate limiting on `/api/auth/login`.** D1 write latency is the only brake. Worth a KV or
   Durable Object counter before the site is findable by anyone but friends.
3. **A signed-in rider cannot add a park or coaster** — those are shared-database writes and
   still need the password. `/log` hides its inline adders for non-admin accounts and says why,
   but the real answer is the request-then-approve flow already sketched for `/add`.
4. **No admin UI for accounts.** `is_admin` is a column you set by hand; invites are minted with
   the curl above. Fine for five riders, not for fifty.
5. **Expired sessions** are deleted when next presented, not swept. Harmless at this size.

### 4. Per-rider tokens — discussed 2026-07-29, not built, now **superseded**

Accounts (§3) did what this was for: attribution, least privilege, revocability. Kept here
because the reasoning still explains why the shared password survived as long as it did.

It was **not** about privacy — every rider's count, rides and rankings are public either way.
It was about **write authorization**, and it bought three things:

- **Attribution.** The rider was a *dropdown*, so whoever had the password picked who they were
  logging as. A mis-set dropdown quietly wrote rides into someone else's count. Accounts fix
  that by making the dropdown *be* you — on `/log` it is locked to your own name.
- **Least privilege.** One password unlocked `/log`, `/add` **and** `/edit`. An account opens
  only your own count.
- **Revocability.** Change one person's password instead of re-texting everyone a new one.

A link is a **bearer credential** — anyone holding the URL is that person. Still true of the
invite links in §3, which is why they are single-use.

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
- **`Celebration City` is geocoded to the wrong city.** It sits at 39.219, -94.504 — Kansas
  City — but it was a Branson park, next door to Silver Dollar City (36.668, -93.339). Found by
  the "Near me" sort on `/log`, which listed it 9 miles from downtown KC. It also plots in the
  wrong place on the stats map. The geocoder took a bad Nominatim hit; fixing it means setting
  real coordinates in `/edit` (note `PUT /api/park` COALESCEs, so it will **not** overwrite
  existing coordinates — this one has to be changed in the editor or in D1 directly). A sweep for
  parks within ~1 mile of each other turned up no other bad geocodes: those clusters are all
  real (Disneyland/DCA, Universal's two parks, the Gatlinburg coaster strip).
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
