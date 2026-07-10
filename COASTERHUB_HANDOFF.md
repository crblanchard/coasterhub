# Coaster Hub — Session Handoff

_Local-only file (git-ignored). Last updated by a Cowork session on 2026-07-07 (~1am PT)._

This exists so a fresh session can pick up mid-task without re-deriving context.

**STATUS UPDATE (2026-07-10) — BIG ARCHITECTURE CHANGE: the site is now D1-backed.**
- **Keltan** imported as a 4th rider from coaster-count.com (`keltan.json`, 795 credits, 597 first-ridden dates → timeline). `coasters.json` grew to 1170 (350 new coasters, ids 825-1174, thin/QC-flagged).
- **Cloudflare D1** (`coasterhub`, id `d4742d82-f606-498a-8520-bcbfec7dcf91`) is now the source of truth: tables `coasters`/`parks`/`rides`(Carter)/`credits`(Cole,Max,Keltan)/`users`. `worker.js` (wrangler `main`) serves `/api/coasters|parks|user/<slug>` (public, same shapes as before) + gated writes (`PUT /api/coaster/:id`, `POST /api/merge|coaster|credit`, `/api/admin/seed|geocode`). `app.js` now reads the API **with static-JSON fallback** (the .json files stay as seed + safety net).
- **`/edit`** = password-gated admin editor (search/sort by park→name, pick-or-type dropdowns for loc/manu/model, Steel/Wood select, merge duplicates, geocode button). Needs Worker secret **`ADMIN_PASSWORD`** (Cloudflare dashboard → coasterhub → Settings → Variables and secrets). **Carter was setting this — confirm before assuming writes work.**
- **Geocoder** (`/api/admin/geocode`, OSM Nominatim) filled parks 114→~208; Keltan's mapped parks 63→144. ~40 remain un-geocodable (traveling carnivals, "?????") — hand-enter or leave off the map.
- **New logo/thumbnail** with a *flush* coaster loop (previous loop floated off the track): `mark.svg`, `favicon*.svg/png`, `apple-touch-icon.png`, `og-image.png`, `logo.svg/png`.
- **Deploy gotcha (new):** Workers Build runs `npx wrangler deploy`; entry file MUST be `worker.js` (NOT `_worker.js` — wrangler rejects it as an asset), and `worker.js`/`wrangler.jsonc`/`.assetsignore` are in `.assetsignore`. Sandbox→Windows writes sometimes truncate — verify a committed file's tail.

---

**STATUS UPDATE (2026-07-07):** Max is now imported and LIVE (commit `bf44222`). `max.json` = 418 unique credits (9 racing-coaster dupes collapsed from 427), added to `USERS`, 132 new coasters appended to `coasters.json` (now 825), milestones show round hundreds (#1/#100/#200/#300/#400/#427). Also added an unlisted QC page at `/database` (database.html — lists every coaster in the DB, flags incomplete rows; not linked in nav).

**Remaining Max cleanup (QC):** ~332 coasters are "incomplete" (missing type/height/speed/length) — mostly Max's 132 new ones, which currently default to `type:"Steel"` and have null stats, so steel/wood split + records don't fully reflect them. New parks are NOT in `parks.json`, so Max's new-park coasters don't plot on the map and his geography only counts coasters with a `loc` filled. One bad park value to fix: coaster id 793 park = "?????". Use `/database` (+ "Only incomplete" filter) to work through these; `tools/import-captaincoaster.js` can backfill details. Edited source workbook preserved locally as `maxlist-edited.xlsx` (git-ignored).

---

## Project at a glance

- **What it is:** a static site (HTML/CSS/vanilla JS) that visualizes roller-coaster "counts" for one or more riders. Live at **coasterhub.org**.
- **Hosting/deploy:** Cloudflare Pages, auto-deploys on every push to `main` on GitHub (`crblanchard/coasterhub`). Clean URLs (`/stats` serves `stats.html`). `_redirects` rewrites `/user/<name>/stats` → `/stats` etc. for per-rider pretty URLs.
- **Repo (on this machine):** `C:\Users\Carter\Documents\GitHub\coasterhub`
- **Line endings:** the HTML files + `style.css` are **CRLF**; `app.js` is **LF**. Preserve each to avoid giant whitespace diffs.

### Key files
- `index.html` – home. Leads with combined unique-credits headline; renders one card per rider dynamically + a "User" dropdown. Data-driven from `app.js` `USERS`.
- `stats.html` – per-rider dashboard (KPIs, on-this-day, records, **milestones**, map, activity, charts). Reads the active user via URL.
- `coasters.html` – full filterable/sortable table. **Default sort: Park asc, then coaster name asc.** Has a conditional "Credit #" column.
- `app.js` – the data engine (`computeStats`) + nav (`initNav`, `USERS`, `userPageHref`). Node-testable. Docstring at top documents all accepted user-file shapes.
- `carter.json`, `cole.json` – the two existing rider files.
- `coasters.json` – **master coaster list** (currently 693 entries). IMPORTANT: this is only the union of Carter's + Cole's coasters, **not** a global DB.
- `parks.json` – `{ "<Park Name>": {lat, lon, region}, ... }` for the map.
- `mark.svg` / `logo.svg` / `favicon*.*` / `apple-touch-icon.png` / `og-image.png` – brand assets (coaster-loop mark + wordmark).
- `tools/import-captaincoaster.js`, `tools/import-credits.js`, `tools/coaster-overrides.json` – importer helpers (fetch coaster details, map external names → ids).

### Rider data-file format (from app.js docstring)
```
{user, credits:["id", ...]}                        // collection only
{user, credits:[{c:"id", n:12}, ...]}              // + ride counts
{user, credits:[{c:"id", first:"YYYY-MM-DD"}, ...]}// + first-ridden dates
{user, credits:[{c:"id", num:200}, ...]}           // + credit numbers (milestones)
{user, rides:[{c:"id", d:"YYYY-MM-DD"}, ...]}       // full dated log (unlocks everything)
```
The engine detects four INDEPENDENT capabilities and only shows panels the data supports:
`firstDates` (timeline), `rideCounts` (total rides/most-ridden), `activity` (calendar/biggest days), **`order`** (credit numbers → milestones). Adding a rider = drop a `<name>.json` in the repo root + add `{ slug, name }` to the `USERS` array in `app.js` (near line 314). Home cards, combined total, and the dropdown all render from `USERS` automatically (alphabetical).

---

## How to publish (IMPORTANT — there are two gotchas)

1. **The sandbox cannot push to GitHub** (proxy returns 403). Commits must be made locally, then pushed from the **GitHub Desktop** app.
2. **GitHub Desktop is usually running and watches the repo**, which races the sandbox `git` on `.git/index` and corrupts it (`bad signature 0x00000000`). To avoid this, **commit into a private temp index**, e.g.:
   ```bash
   cd <repo>
   export GIT_INDEX_FILE=/tmp/ci.index && rm -f /tmp/ci.index
   git read-tree HEAD && git add -A
   git reset -q HEAD -- .gitignore .fuse_hidden0000000700000001   # keep gitignore, drop fuse temp
   git commit -q -m "message"
   unset GIT_INDEX_FILE && rm -f .git/index && git read-tree HEAD  # rebuild real index for GHD
   ```
   Then **push via GitHub Desktop**: `open_application "GitHub Desktop"` → screenshot → click the blue **Push origin** button (was ~x1261,y381) → wait → confirm the toolbar flips to "Fetch origin". (Requesting access: `githubdesktop.exe` is the process name; the window may need it granted explicitly.)
3. Do **not** commit `.fuse_hidden*` (a stale temp), the `max-credits-*.xlsx` working file (git-ignored), or `COASTERHUB_HANDOFF.md` (git-ignored).
4. Verify live: Chrome MCP → navigate coasterhub.org → `ctrl+shift+r` (hard reload; Cloudflare/browser cache) → screenshot. Note: `stats.html` is heavy (Leaflet+Chart.js) and screenshots sometimes time out — retry, or check `coasters.html`/home which are lighter.

Current `main` HEAD at handoff: **`d9dba8a`** (milestones). Everything through here is already deployed.

---

## OPEN TASK: import Max's count

**Goal:** add Max as a third rider. He tracks credit **numbers** (1–427) but **no dates and no ride counts** — so his page will be collection-style + the new **milestones** panel (1st / 100th / 200th / 300th / 400th / 427th coaster).

### His source data
- Google Sheet (shared, "anyone with link can edit"): `https://docs.google.com/spreadsheets/d/1r08-DlIrmpyPXLQu6PzIpkv12K298JVJ6ptJ2iLdrSk/edit`
- CSV export that works: `.../export?format=csv&gid=0` (or the `gviz/tq?tqx=out:csv&gid=0` endpoint).
- Columns A/B = **credit name + number, 1..427** (the credit list). Columns D/E = a **separate top-70 favorites ranking** — IGNORE for the import.

### The review/edit workbook Carter is filling
- Path: `C:\Users\Carter\Documents\GitHub\coasterhub\max-credits-to-finalize.xlsx` (git-ignored; also a copy in the session outputs dir). Carter is editing it **now** and will upload the finished version.
- Sheets: "How to use", "Max credits" (427 rows), "Parks (reference)".
- Columns on "Max credits": `A #` · `B Coaster (Max's list)` · `C Status` · `D My best-guess match` · `E Park` · `F Location` · `G Notes/options` · `H Your corrections`.
- **Read back precedence (per Carter): `H corrections` > `D match` > `E/F Park+Location`.**
  - If `D` names a real master coaster → resolve to that exact coaster's id (auto-fill its park/loc). If `D` names something not in the master list → it's a new coaster to add.
  - `E Park` disambiguates rows where the name is right but the park was unknown.
  - `H` may say things like "wrong, this is X" or **`SKIP`** (leave the row out — some entries are joke/non-credits).

### Match state when the file was generated (auto-match, pre-edits)
195 clean matches · 91 ambiguous (name shared across parks) · 12 fuzzy guesses · **129 "new"** (not in `coasters.json` at all — mostly his Japan trip + small/family/kiddie coasters).

### Steps to finalize (once Carter uploads the edited xlsx)
1. Read the uploaded workbook (it will land in the session `uploads/` folder). Parse the "Max credits" sheet; apply the precedence above per row.
2. For each credit, resolve to **either** an existing `coasters.json` id **or** a new coaster.
3. **New coasters:** add them to `coasters.json`. Each needs at least `id` (next free id after 693), `name`, `park`, `loc`, `type` (Steel/Wood). For records/geography to work well also want `h,s,l,inv,yr,opened,dur,laps,manu,model`. Use `tools/import-captaincoaster.js` to fetch these where possible; otherwise fill park/loc from Carter's columns and reasonable defaults, and flag the thin ones. Add any **new parks** to `parks.json` with `{lat, lon, region}` (else they won't plot on the map — the coaster still counts via its `loc`).
4. Build **`max.json`**: `{"user":"Max","credits":[{"c":<id>,"num":<N>}, ...]}` — carry the credit number as `num` so milestones work.
5. Add `{ slug: "max", name: "Max" }` to the `USERS` array in `app.js`.
6. Publish (see "How to publish"), then verify Max's pages live: `/user/max/stats` (milestones panel, KPIs) and `/user/max/coasters` (Credit # column), plus the home combined total + dropdown now showing Max.

### Known nuances / decisions to surface to Carter
- **Duplicate credits:** the engine keys credits by **unique coaster id** (a set), so racing/dual-track coasters he counted twice (e.g. Gemini 66/67, American Eagle 148/149, Space Mountain 84/85, Primeval Whirl 87/88) collapse to one id, and for a duplicated id the last `num` wins. His on-site "credits" count will therefore be **< 427** unless we decide to handle dupes specially. Ask Carter how he wants duplicates counted.
- **`coasters.json` grows a lot** with Max (up to ~129 new). That's expected; it stays the shared master list.
- Combined "unique credits" on the home page recomputes automatically from all riders once Max is added.

---

## Also live / done this session (context)
- New brand: coaster-loop **logo/mark + wordmark**, SVG + PNG favicons, apple-touch-icon, `og-image.png`. Header uses `mark.svg` + CSS wordmark.
- Nav **"User" dropdown** (alphabetical) that shows the active rider's name on their pages; Stats/Coasters links follow the selected rider.
- **Shared-hub framing:** every page uses the rider's name; home leads with combined unique credits + dynamic rider cards.
- `coasters.html` default sort = Park, then name.
- **Milestones feature** (commit d9dba8a): `order` capability, `sec_milestones` section in stats, "Credit #" column in coasters.
- Fixed a pre-existing bug: `index.html` was truncated in the repo (broken footer/scripts) — rebuilt.

## Scheduled reminders
- `add-max-count-to-coasterhub` — fires **2026-07-08 09:00 PT**, reminds to finish this import (has the sheet link + model notes).
- `zoho-email-setup-reminder` — **disabled** (Carter deprioritized it; can be deleted from the Scheduled sidebar).
