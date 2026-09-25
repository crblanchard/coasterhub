// Coaster Hub — Worker entrypoint.
// Serves the static site (via the ASSETS binding) and a small JSON API backed
// by a D1 database (binding: DB). The API is additive and DEFENSIVE: if D1 is
// not bound yet, every /api/* route returns 503 and the static site still works
// exactly as before.
//
// Reads are public. Writes come in two kinds:
//   - a rider's own rides and rankings, authorized by their ACCOUNT (see the
//     Accounts section below, and migrations/003-accounts.sql);
//   - everything shared — the coaster and park database, merges, imports —
//     which needs ADMIN rights: an is_admin ACCOUNT, or ADMIN_PASSWORD.
// ADMIN_PASSWORD also opens the first kind, so it stays the break-glass key and
// the riders who have not claimed an account yet keep working exactly as
// before. It is no longer needed day to day, and unsetting the secret leaves
// admin accounts as the only way in.
//
// The one exception, deliberately: a claimed rider's RANKINGS have no admin
// override at all. See the PUT route for why.
//
// Bindings (see wrangler.jsonc):
//   ASSETS  - static assets (the repo files)
//   DB      - D1 database "coasterhub"
//   ADMIN_PASSWORD - secret; required for shared-database writes + /api/admin/*
//   RESEND_API_KEY - secret; without it password reset is off (and says so)
//   MAIL_FROM      - optional; "Coaster Hub <hello@coasterhub.org>" by default,
//                    and must be on a domain verified with Resend

// no-store on every JSON answer by default.
//
// These responses carried NO cache-control at all, which does not mean "do not
// cache" — with no max-age and no validator a browser falls back to HEURISTIC
// freshness and may serve a cached copy for a while without asking. That is how
// a profile came back wearing its owner's previous picture right after they
// replaced it: /api/auth/me was answered from the browser cache with the old
// avatar key in it, and the page dutifully drew the old file, which is still in
// that browser's cache too because avatars are immutable. It corrected itself
// on the next real request, which is exactly the "funky at first, fine when I
// click it" shape.
//
// Everything behind /api/ is either live data or who you are, so none of it may
// be served stale. The two big slow-moving lists opt back IN to a short cache
// explicitly (see /api/coasters and /api/parks) — an explicit small max-age is
// both faster and safer than leaving a browser to guess.
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8",
                       "cache-control": "no-store" };
// The coaster and park lists: ~900 rows between them, fetched by nearly every
// page, and they change when somebody adds a coaster rather than continuously.
const LIST_CACHE = { "cache-control": "public, max-age=300" };

// ---- ...and the header alone was not enough ---------------------------------
// A `cache-control` on a response the WORKER MAKES is a promise to the browser
// and nothing more. Cloudflare does not store a Worker's own response unless
// the Worker puts it there, so `public, max-age=300` above saved a RETURNING
// visitor a fetch and saved the database nothing at all: the next visitor, and
// every crawler, still paid for a full read of the coaster table.
//
// That read is 1,239 rows — 1,129 coasters plus their aliases — on every single
// page view, and on 2026-09-20 it carried the D1 free tier's 5,000,000 rows a
// day to 95% against a database holding 5,694 rides. Cloudflare's own count,
// from the alert mail, not an estimate. Every page fetches this list when it
// renders, so a crawler that executes JavaScript pays it per page, and there
// are 1,129 coaster pages and 249 park pages to walk.
//
// So the three slow-moving lists go in the edge cache explicitly. Two rules
// keep that honest:
//
//   * A request carrying ANY cookie is served fresh and never stored. That is
//     every signed-in reader and every admin, which is what /edit needs: it
//     acts on what the list says, and a five-minute-old list is how a console
//     script once tried to rename a park that had already been renamed. The
//     traffic the cache is for is the anonymous kind, and none of these three
//     answers has ever depended on who was asking.
//   * The key is the origin and the PATH, never the query string, so
//     /api/coasters?utm=whatever cannot fill the cache with copies of one
//     answer — or push the real entry out of it.
//
// The TTL is the max-age these responses already declared, so nothing is
// staler for anybody than it was before. A write purges the entries, but the
// Cache API deletes in ONE colo — the one that served the write — so the person
// editing sees their own change at once and everybody else waits out the 300s.
// That is the trade, written down here so the next person reads it as a choice
// rather than a bug. `caches` is also absent in the node:sqlite test harness
// and inert on a workers.dev hostname, so every call is guarded: a cache that
// is not there must cost correctness nothing.
const EDGE_CACHED = { "/api/coasters": 1, "/api/parks": 1, "/api/clones": 1 };

// Every table keyed by a coaster id besides rides and aliases. A merge repoints
// them to the survivor and a delete sweeps them, because a row left pointing at
// an id with no coaster behind it is the "#137" bug (see the merge route).
// Several belong to migrations a database may not have run yet, so each one is
// touched in its own try.
const KEYED_BY_COASTER = [
  ["rankings", "coaster_id"],
  ["clone_members", "coaster"],
  ["rider_category_members", "coaster"],
  ["category_skipped", "coaster"],
  ["model_skipped", "coaster"],
];
function edgeKey(url, path) {
  const u = new URL(url);
  return new Request(u.origin + (path || u.pathname), { method: "GET" });
}
function edgeUsable(request) {
  return typeof caches !== "undefined" && caches.default && !request.headers.get("cookie");
}
async function edgeGet(request) {
  if (!edgeUsable(request)) return null;
  try { return (await caches.default.match(edgeKey(request.url))) || null; }
  catch (e) { return null; }
}
function edgePut(ctx, request, response) {
  if (edgeUsable(request)) {
    try { ctx.waitUntil(caches.default.put(edgeKey(request.url), response.clone())); }
    catch (e) { /* not cacheable here; the answer is still correct */ }
  }
  return response;
}
// Every list, not only the one the write touched: a merge moves a coaster and a
// park in the same breath, and working out which entries a given write could
// have invalidated is a rule that would rot. Three deletes cost nothing.
function edgeDrop(ctx, request) {
  if (typeof caches === "undefined" || !caches.default) return;
  for (const path of Object.keys(EDGE_CACHED)) {
    try { ctx.waitUntil(caches.default.delete(edgeKey(request.url, path))); }
    catch (e) {}
  }
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}
function err(status, message) { return json({ error: message }, status); }

// After a successful D1 write, nudge GitHub to re-sync the static JSON snapshot
// (coasters.json / parks.json / <rider>.json) so the pages that read those files
// directly stay in step with the live data. Fire-and-forget via ctx.waitUntil so
// it never slows down or blocks the edit. No-op until a GITHUB_TOKEN secret (a
// fine-grained PAT with Contents: write on this repo) is configured; the Actions
// side debounces a burst of edits into a single commit.
// Also drops the edge-cached lists, so the person who just made the change is
// not shown their own stale copy of it — see the note on edgeDrop.
function afterWrite(ctx, env, request, response) {
  ctx.waitUntil(dispatchSync(env));
  edgeDrop(ctx, request);
  return response;
}
async function dispatchSync(env) {
  if (!env.GITHUB_TOKEN) return;
  try {
    await fetch("https://api.github.com/repos/crblanchard/coasterhub/dispatches", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.GITHUB_TOKEN,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "coasterhub-worker",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: "edit" }),
    });
  } catch (e) { /* best-effort; never let a sync hiccup break an edit */ }
}

// Constant-time-ish equality for the admin token.
function tokenOk(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const hdr = request.headers.get("x-admin-token") || "";
  const cookie = (request.headers.get("cookie") || "").match(/(?:^|;\s*)ch_admin=([^;]+)/);
  const supplied = hdr || (cookie ? decodeURIComponent(cookie[1]) : "");
  if (supplied.length !== env.ADMIN_PASSWORD.length) return false;
  let diff = 0;
  for (let i = 0; i < supplied.length; i++) diff |= supplied.charCodeAt(i) ^ env.ADMIN_PASSWORD.charCodeAt(i);
  return diff === 0;
}

// ---- Accounts -------------------------------------------------------------
// ADMIN_PASSWORD above is still the break-glass key and still opens everything.
// What accounts add is *identity*: a session says which rider you are, so the
// ride and ranking routes can refuse a write into someone else's count. See
// migrations/003-accounts.sql for the tables.
//
// Hashing is PBKDF2-HMAC-SHA256 via WebCrypto — the only KDF the Workers runtime
// offers without shipping wasm. The iteration count is stored *in* the hash, so
// changing it later re-hashes people on their next sign-in instead of locking
// them out.
//
// 100000 is the CEILING, not a preference: the Workers runtime rejects anything
// above it outright ("iteration counts above 100000 are not supported"), which
// is below OWASP's current advice for this algorithm. Node's WebCrypto has no
// such limit, so a local test will happily accept a number production refuses —
// this shipped at 210000 and failed on the first real sign-up. The test suite
// now asserts the ceiling. If stronger hashing is wanted, it needs a different
// KDF (scrypt/argon2 via wasm), not a bigger number here.
const PBKDF2_MAX_ITERS = 100000;
const PBKDF2_ITERS = PBKDF2_MAX_ITERS;
const SESSION_DAYS = 90;
const COOKIE = "ch_sess";

const enc = new TextEncoder();
function b64(bytes) { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function hex(bytes) { return [...bytes].map(b => b.toString(16).padStart(2, "0")).join(""); }

// Same shape as tokenOk's compare: length first, then every byte, so a wrong
// password takes the same time whether it differs in the first character or the
// last.
function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashPassword(pw, saltIn, itersIn) {
  const salt = saltIn || crypto.getRandomValues(new Uint8Array(16));
  const iters = itersIn || PBKDF2_ITERS;
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: iters }, key, 256);
  return "pbkdf2$sha256$" + iters + "$" + b64(salt) + "$" + b64(new Uint8Array(bits));
}
async function verifyPassword(pw, stored) {
  const p = String(stored || "").split("$");
  if (p.length !== 5 || p[0] !== "pbkdf2" || p[1] !== "sha256") return false;
  const iters = Number(p[2]);
  // Bound the stored count: a corrupted row saying 10 iterations must not
  // silently downgrade the check, and one above the runtime ceiling would throw
  // rather than return — a 500 on the login route instead of a clean "no".
  if (!Number.isInteger(iters) || iters < 10000 || iters > PBKDF2_MAX_ITERS) return false;
  let salt;
  try { salt = unb64(p[3]); } catch (e) { return false; }
  try {
    return sameString(await hashPassword(pw, salt, iters), stored);
  } catch (e) { return false; }
}

// A real hash of a throwaway string, so signing in with an unknown email can do
// the same PBKDF2 work as a known one. Without it, "no such account" returns in
// microseconds and "wrong password" in ~100ms, which is a readable answer to
// "does this person have an account here?".
const DUMMY_HASH = "pbkdf2$sha256$100000$H9X3LabUcAffgcYCyj1o0g==$7sAIfFxqCdYJxURiUnrHT7zP+kFgAnGW0eMX7uxJpAo=";

// Has migrations/003-accounts.sql been applied?
//
// This matters because a push to main deploys the Worker immediately while the
// migration is run by hand: for the window between the two, `accounts` does not
// exist. Every account-aware path asks this first and degrades to exactly the
// old behaviour — the shared password — rather than throwing "no such table"
// into a rankings save. Same defensiveness as the unbound-D1 case above.
// Deliberately NOT cached per isolate. A cached "yes" would outlive the thing it
// describes — a rolled-back database, a test that drops the table — and the
// saving is one trivial query on paths that are already doing a write or a
// password hash. The public read paths never call this at all.
async function haveResets(env) {
  try {
    await env.DB.prepare("SELECT 1 FROM resets LIMIT 1").first();
    return true;
  } catch (e) { return false; }
}
async function haveAccounts(env) {
  try {
    await env.DB.prepare("SELECT 1 FROM accounts LIMIT 1").first();
    return true;
  } catch (e) { return false; }
}

function randomToken() { return hex(crypto.getRandomValues(new Uint8Array(32))); }
async function sha256hex(s) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))));
}

// The cookie holds the raw token; the table holds its SHA-256. A dump of
// `sessions` therefore cannot be replayed as a login — the same reason the
// password column holds a hash.
async function startSession(env, accountId) {
  const raw = randomToken();
  const now = new Date();
  await env.DB.prepare("INSERT INTO sessions (token,account,created,expires) VALUES (?,?,?,?)")
    .bind(await sha256hex(raw), accountId, now.toISOString(),
          new Date(now.getTime() + SESSION_DAYS * 86400000).toISOString()).run();
  return raw;
}
// Secure is unconditional: the Worker 301s http to https before any route runs,
// so there is no plaintext context left for the cookie to be useful in.
function setCookie(raw) {
  return COOKIE + "=" + raw + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" +
    (SESSION_DAYS * 86400);
}
function clearCookie() {
  return COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
function cookieToken(request) {
  const m = (request.headers.get("cookie") || "").match(/(?:^|;\s*)ch_sess=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

// Who is signed in, or null. Resolved once per request in fetch() and passed
// around: every call costs a SHA-256 and a join, and the write routes would
// otherwise each redo it.
// ---- scratch-copy mode ----------------------------------------------------
//
// DEV_AS turns the whole site into one signed-in rider with no login at all:
// set it to a slug and every request is that person, as an admin. It exists so
// a throwaway copy of the site can be poked at without inventing accounts.
//
// It is a COMPLETE bypass of authentication. Production must never set it, and
// nothing here tries to guess whether it is production — the variable's absence
// IS the guard, which is why it lives in wrangler.staging.jsonc and in no other
// config. The skin it forces onto every page (plain black or plain white
// header, DEV beside the wordmark) is not decoration: it is how you know which
// copy you are looking at before you type something into it.
function devAs(env) { return String(env && env.DEV_AS || "").trim().toLowerCase(); }

async function devAccount(env) {
  const slug = devAs(env);
  if (!slug) return null;
  const u = await env.DB.prepare("SELECT slug, name FROM users WHERE slug = ?").bind(slug).first();
  let bio = null, avatar = null;
  try {
    const p = await env.DB.prepare("SELECT bio, avatar FROM users WHERE slug = ?").bind(slug).first();
    if (p) { bio = p.bio || null; avatar = p.avatar || null; }
  } catch (e) { /* migration 008 not applied */ }
  return { id: 0, email: slug + "@dev.local", slug: slug, name: (u && u.name) || slug,
           admin: true, bio: bio, avatar: avatar, dev: true };
}

// Stapled into every HTML page this copy serves. Exported so tools/dev-server
// can staple the same thing on — local and the hosted copy have to look alike
// or the skin stops meaning "not production" and starts meaning "not my laptop".
export const DEV_SKIN =
  '<style id="devskin">' +
  // Plain black in the dark and plain white in the light, blur off, so a
  // screenshot is never ambiguous about which site it came from.
  //
  // ONE light selector, not a prefers-color-scheme fallback as well: this site
  // is dark until you press the toggle and ignores the OS entirely (see
  // readTheme in app.js). Honouring the OS here would put a white header on a
  // dark page for anybody whose laptop is in light mode.
  'header.nav{background:#000 !important;border-bottom:1px solid rgba(255,255,255,.22) !important;' +
  'backdrop-filter:none !important;-webkit-backdrop-filter:none !important}' +
  ':root[data-theme="light"] header.nav{background:#fff !important;' +
  'border-bottom:1px solid rgba(0,0,0,.18) !important}' +
  // The word, inside the header so it cannot collide with the mobile tab bar.
  '.brand-text::after{content:" DEV";color:#ff5a5f;font-weight:800;font-size:.6em;' +
  'letter-spacing:.16em;vertical-align:.35em;margin-left:6px}' +
  '</style>';

// Only text/html, and only the <head> — an asset that is not a page is passed
// straight back, and a page with no </head> is left exactly as it was.
async function devSkin(res, env) {
  if (!devAs(env)) return res;
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;
  const html = await res.text();
  if (!html.includes("</head>")) return new Response(html, res);
  const out = new Response(html.replace("</head>", DEV_SKIN + "</head>"), res);
  out.headers.set("content-type", type);
  return out;
}

async function currentAccount(request, env) {
  const raw = cookieToken(request);
  if (!raw) return null;
  if (!await haveAccounts(env)) return null;
  const row = await env.DB.prepare(
    "SELECT a.id AS id, a.email AS email, a.slug AS slug, a.is_admin AS adm, " +
    "u.name AS name, s.expires AS expires FROM sessions s " +
    "JOIN accounts a ON a.id = s.account LEFT JOIN users u ON u.slug = a.slug " +
    "WHERE s.token = ?"
  ).bind(await sha256hex(raw)).first();
  if (!row) return null;
  // Separate query for the profile columns so a database without migration 008
  // still signs people in — the session is the important part.
  let bio = null, avatar = null;
  try {
    const p = await env.DB.prepare("SELECT bio, avatar FROM users WHERE slug = ?").bind(row.slug).first();
    if (p) { bio = p.bio || null; avatar = p.avatar || null; }
  } catch (e) { /* migration 008 not applied yet */ }
  if (!(new Date(row.expires) > new Date())) {
    // Expired: drop it now rather than leaving dead rows for a cleanup job that
    // does not exist. The cookie is cleared by whatever route noticed.
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(await sha256hex(raw)).run();
    return null;
  }
  return { id: row.id, email: row.email, slug: row.slug, name: row.name, admin: !!row.adm,
           bio: bio, avatar: avatar };
}

// May this request write to <slug>'s rides or rankings?
//
// Three ways in, in the order they are cheapest to check: the shared admin
// password, an account flagged admin, or the account that owns that very rider.
// Anything else is a 401 — including a signed-in rider aiming at someone else's
// count, which is precisely the hole accounts were added to close.
// Admin rights: the shared password, or an account flagged is_admin.
//
// ADMIN_PASSWORD came first and everything was gated on it. An admin ACCOUNT
// now does the same job better — it says who acted, it is revoked by changing
// one person's password, and there is nothing to text anybody. The password
// stays as break-glass and for scripts (the curl in the handoff), but it is no
// longer needed day to day: leaving the secret unset simply means accounts are
// the only way in, since tokenOk() returns false without it.
function adminOk(request, env, acct) {
  return tokenOk(request, env) || !!(acct && acct.admin);
}

function mayWriteRider(request, env, slug, acct) {
  if (tokenOk(request, env)) return true;
  if (!acct) return false;
  if (acct.admin) return true;
  return !!slug && !!acct.slug && acct.slug === String(slug).toLowerCase();
}

// ---- Sending mail ---------------------------------------------------------
// Resend, over plain HTTPS — no SDK, which matters in a Worker. Configure with
// two secrets:
//
//   RESEND_API_KEY   re_...  from resend.com
//   MAIL_FROM        optional; defaults to the address below, which must be on
//                    a domain verified with Resend or every send is rejected
//
// Without the key nothing is sent and the caller is told so, rather than the
// site pretending a reset email is on its way to somebody who will wait for it
// forever. Same defensiveness as the unbound-D1 and missing-table paths.
const MAIL_FROM_DEFAULT = "Coaster Hub <hello@coasterhub.org>";

function mailConfigured(env) { return !!env.RESEND_API_KEY; }

// The mark, as a PNG. NOT mark.svg: most mail clients will not render SVG, and
// a broken image in a password-reset email is the last thing that should look
// wrong. 180px served at 48, so it stays sharp on a retina screen.
const MAIL_LOGO = "https://coasterhub.org/apple-touch-icon.png?v=20260924b";

// Both parts, every time. Plain text is what a screen reader, a terminal client
// and a spam filter all prefer; the HTML is for everyone else. Sending only
// HTML is a small deliverability penalty for no reason.
function mailHtml(subject, body, action) {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // Inline styles and a table: email clients have no <style> support worth
  // relying on, and the dark palette here is fixed rather than themed because
  // prefers-color-scheme in mail is a coin flip.
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
    + 'style="background:#0b1020;padding:28px 0;font-family:-apple-system,BlinkMacSystemFont,'
    + '\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif"><tr><td align="center">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
    + 'style="max-width:460px;background:#121a33;border:1px solid #23304f;border-radius:14px;'
    + 'padding:26px 28px"><tr><td>'
    + '<img src="' + MAIL_LOGO + '" width="48" height="48" alt="Coaster Hub" '
    + 'style="display:block;border:0;border-radius:10px;margin-bottom:16px">'
    + '<div style="color:#e8edf9;font-size:17px;font-weight:700;margin-bottom:10px">'
    + esc(subject) + '</div>'
    + body.split("\n\n").map((p) =>
        '<p style="color:#9fb0d0;font-size:14px;line-height:1.6;margin:0 0 12px">'
        + esc(p).replace(/\n/g, "<br>") + '</p>').join("")
    + (action
        ? '<p style="margin:18px 0 6px"><a href="' + esc(action.href) + '" '
          + 'style="display:inline-block;background:#3ad6c8;color:#0b1020;font-weight:700;'
          + 'font-size:14px;text-decoration:none;padding:11px 20px;border-radius:9px">'
          + esc(action.label) + '</a></p>'
          + '<p style="color:#6d7f9f;font-size:12px;line-height:1.6;margin:10px 0 0;'
          + 'word-break:break-all">Or paste this in: ' + esc(action.href) + '</p>'
        : "")
    + '<p style="color:#6d7f9f;font-size:12px;margin:20px 0 0">coasterhub.org</p>'
    + '</td></tr></table></td></tr></table>';
}

async function sendMail(env, { to, subject, text, action }) {
  if (!mailConfigured(env)) return { bad: "email is not configured on this deployment" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.MAIL_FROM || MAIL_FROM_DEFAULT, to: [to], subject, text,
                           html: mailHtml(subject, text, action) }),
  });
  if (!res.ok) {
    // Resend puts the real reason in the body — an unverified domain, a bad
    // key. Carry it into the log rather than a bare status, because "550" on
    // its own has cost people hours.
    let why = "";
    try { why = JSON.stringify(await res.json()); } catch (e) { why = "HTTP " + res.status; }
    return { bad: "could not send the email: " + why };
  }
  return { ok: true };
}

const RESET_MINUTES = 60;

// A caption on a count, not a second page of prose in front of the numbers.
const BIO_MAX = 280;
// Avatars are cropped and resized in the browser before upload (see
// /account), so anything above this is a client that did not, or someone
// poking the endpoint by hand.
const AVATAR_MAX_BYTES = 512 * 1024;
const AVATAR_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function emailOk(s) {
  return typeof s === "string" && s.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}
// Length only. A composition rule ("one number, one symbol") mostly teaches
// people to write Password1! — a floor of 8 with no ceiling below 200 is the
// current NIST advice and is what the sign-up copy promises.
function passwordProblem(s) {
  if (typeof s !== "string" || s.length < 8) return "pick a password of at least 8 characters";
  if (s.length > 200) return "that password is too long";
  return null;
}

// Columns on the coasters table, in order (id is managed separately).
const COASTER_FIELDS = ["name","park","type","manu","model","h","s","l","inv","dur","laps","yr","opened","openedPrec","closed","closedPrec"];

// ---- Row <-> API shape helpers -------------------------------------------
function coasterRow(r) {
  const o = { id: r.id };
  for (const f of COASTER_FIELDS) o[f] = r[f] === undefined ? null : r[f];
  return o;
}

async function getCoasters(env) {
  const { results } = await env.DB.prepare("SELECT * FROM coasters ORDER BY id").all();
  return results.map(coasterRow);
}
// Former names, so a rename or a retheme doesn't read as a missing coaster.
// Someone typing "Intimidator" at Carowinds should land on Thunder Striker
// rather than create a second row — no string matcher bridges a retheme, which
// is how most of this table's duplicates got in.
async function getAliases(env) {
  const [c, p] = await Promise.all([
    env.DB.prepare("SELECT coaster_id, former_name FROM coaster_aliases").all(),
    env.DB.prepare("SELECT park, former_name FROM park_aliases").all(),
  ]);
  return {
    aliases: c.results.map(r => ({ c: r.coaster_id, n: r.former_name })),
    parkAliases: p.results.map(r => ({ p: r.park, n: r.former_name })),
  };
}

// Record a former name whenever one stops being current. Called on rename and on
// merge, so the table maintains itself — every alias below the backfill was
// reconstructed by hand from git history, which is not repeatable.
function recordAlias(env, id, formerName, note) {
  if (!formerName) return null;
  return env.DB.prepare(
    "INSERT OR IGNORE INTO coaster_aliases (coaster_id, former_name, note, added) " +
    "SELECT ?, ?, ?, date('now') WHERE NOT EXISTS " +
    "(SELECT 1 FROM coasters WHERE id = ? AND name = ?)"   // never alias a name to itself
  ).bind(id, formerName, note, id, formerName);
}

async function getParks(env) {
  const { results } = await env.DB.prepare("SELECT * FROM parks").all();
  const out = {};
  for (const p of results) out[p.name] = { lat: p.lat, lon: p.lon, region: p.region };
  return out;
}
// Which riders have claimed their page. Used to decide whether a RIDE COUNT is
// worth showing at all: an unclaimed rider's rides came in from a spreadsheet
// import, mostly one row per credit, so "596 rides" is an artifact of how the
// data arrived rather than a number anybody counted. It becomes real the day
// they claim the page and start logging, and the real counts already entered by
// hand (the Europe and Japan trips) stay in the table either way — this hides a
// number, it never deletes a row. Carter's call, 2026-09-17.
//
// Returns a Set of slugs, or null when there is no accounts table yet, which
// the callers treat as "nobody has claimed anything".
async function claimedSlugs(env) {
  if (!await haveAccounts(env)) return null;
  try {
    const { results } = await env.DB.prepare(
      "SELECT slug FROM accounts WHERE slug IS NOT NULL").all();
    return new Set(results.map(r => r.slug));
  } catch (e) { return null; }
}

async function getUser(env, slug) {
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return null;
  const { results } = await env.DB.prepare("SELECT coaster_id, d FROM rides WHERE user_slug = ? ORDER BY id").bind(slug).all();
  // SELECT * above, so bio/avatar arrive on their own once migration 008 has
  // run and are simply undefined before that. Null rather than undefined in the
  // response, so the pages have one thing to test for.
  const claimed = await claimedSlugs(env);
  return { user: u.name, slug: slug, bio: u.bio || null, avatar: u.avatar || null,
           claimed: !!(claimed && claimed.has(slug)),
           rides: results.map(x => ({ c: x.coaster_id, d: x.d })) };
}

// ---- Riders ---------------------------------------------------------------
// The rider list lives in D1, not only in the USERS array in app.js, so someone
// added on /log or /import can be picked and written to straight away instead of
// waiting for a deploy. app.js still ships USERS as the offline fallback.
async function getUsers(env) {
  // Tried with the profile columns and retried without: this is the one query
  // every page makes, and it must not start failing the moment it runs against
  // a database where migration 008 has not been applied.
  const claimed = await claimedSlugs(env);
  const own = (slug) => !!(claimed && claimed.has(slug));
  try {
    const { results } = await env.DB.prepare(
      "SELECT slug, name, avatar FROM users ORDER BY name").all();
    return results.map(u => ({ slug: u.slug, name: u.name, avatar: u.avatar || null,
                               claimed: own(u.slug) }));
  } catch (e) {
    const { results } = await env.DB.prepare("SELECT slug, name FROM users ORDER BY name").all();
    return results.map(u => ({ slug: u.slug, name: u.name, claimed: own(u.slug) }));
  }
}

// The slug IS the URL (/user/<slug>), so it is derived tightly and the page
// names are refused — a rider called "Stats" would shadow a real page. This
// matters more since the profile lost its /stats suffix: the rider segment now
// sits one level from the site root.
const RESERVED_SLUGS = new Set(["api","user","users","admin","new","all","everyone",
  // "park" and "coaster" joined the list when /park/<park>/<coaster> landed:
  // a rider called Park would shadow every one of those pages.
  "park", "coaster", "ride",
  "home","stats","rides","count","rankings","coasters","parks","log","add","edit","import",
  "changes","database","qc","sitemap","index","account","accounts","login","logout",
  "signup","signin","profile","riders","me","auth","session","settings"]);
function slugify(s) {
  return String(s == null ? "" : s).toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
async function addUser(env, body) {
  const name = String(body && body.name || "").trim().replace(/\s+/g, " ");
  if (!name) return { bad: [400, "give the rider a name"] };
  if (name.length > 40) return { bad: [400, "that name is too long"] };
  // A username typed by the person (signup, since 2026-09-24) is answered in
  // username terms — "taken", "2-32 characters" — the way the claim form's is.
  // One derived from a name (/log's + New rider) keeps the name-shaped errors.
  if (body && body.slug) {
    const slug = slugify(body.slug);
    const problem = await slugProblem(env, slug, null);
    if (problem) return { bad: [/taken/.test(problem) ? 409 : 400, problem] };
  }
  const slug = slugify(body && body.slug || name);
  if (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(slug)) {
    return { bad: [400, "that name needs at least two letters or numbers"] };
  }
  if (RESERVED_SLUGS.has(slug)) return { bad: [400, "“" + slug + "” is a page name — pick another"] };
  const clash = await env.DB.prepare("SELECT slug, name FROM users WHERE slug = ?").bind(slug).first();
  if (clash) return { bad: [409, clash.name + " is already here (/user/" + slug + ")"] };
  // mode is 'rides' for everyone since the 2026-07-29 migration; nothing branches
  // on it any more, but the column is still NOT NULL-ish in spirit, so set it.
  await env.DB.prepare(
    "INSERT INTO users (slug,name,mode,email,created) VALUES (?,?,'rides',NULL,datetime('now'))"
  ).bind(slug, name).run();
  await recordActivity(env, "user_added", { actor: slug, subject: name });
  return { ok: true, slug: slug, name: name };
}

// ---- Renaming a rider ------------------------------------------------------
// See migrations/004-user-rename.sql. `slug` is a public URL and a key in five
// other tables; `name` is free text nobody joins on. So they validate
// differently and only one of them is hard to change.

// Is this username free?
async function slugProblem(env, slug, selfSlug) {
  if (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(slug)) {
    return "a username needs 2-32 characters, letters, numbers or hyphens";
  }
  if (RESERVED_SLUGS.has(slug)) return "“" + slug + "” is a page name — pick another";
  if (slug === selfSlug) return null;
  const clash = await env.DB.prepare("SELECT name FROM users WHERE slug = ?").bind(slug).first();
  if (clash) return "“" + slug + "” is taken";
  return null;
}

// The rename. Every table that stores a slug moves together, in one batch,
// because a half-applied rename would detach a rider from their own rides.
//
// It is a MOVE, not a forward: the old username is gone the moment this
// returns, and /user/<old>/ 404s rather than redirecting. Carter's call,
// 2026-09-14, having seen the alternative — the first cut kept a `user_aliases`
// row so old links survived, and he wanted the old id genuinely gone. The
// consequences are the ones you would expect and are the point, not a bug: a
// link someone saved last year breaks, and the freed name can be taken by
// anyone, inheriting nothing except the name itself.
// `quiet` skips the activity row. A rename normally belongs in the feed — it is
// a public name changing under people's links. A rename at CLAIM time does not:
// the old name was a placeholder Carter typed to get the count into the site,
// and announcing "keltan is now <their name>" would publish the one thing
// claiming exists to retire.
async function renameRider(env, from, to, quiet) {
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET slug = ? WHERE slug = ?").bind(to, from),
    env.DB.prepare("UPDATE rides SET user_slug = ? WHERE user_slug = ?").bind(to, from),
    env.DB.prepare("UPDATE rankings SET user_slug = ? WHERE user_slug = ?").bind(to, from),
    env.DB.prepare("UPDATE accounts SET slug = ? WHERE slug = ?").bind(to, from),
    env.DB.prepare("UPDATE activity SET actor = ? WHERE actor = ?").bind(to, from),
    env.DB.prepare("UPDATE invites SET slug = ? WHERE slug = ?").bind(to, from),
  ]);
  // Separately, and only if the table is there: putting these in the batch
  // above would make a rename fail outright on a database that has not run
  // migration 010, and a rename matters more than a follow does.
  try {
    await env.DB.batch([
      env.DB.prepare("UPDATE follows SET follower = ? WHERE follower = ?").bind(to, from),
      env.DB.prepare("UPDATE follows SET followee = ? WHERE followee = ?").bind(to, from),
    ]);
  } catch (e) { /* migration 010 not applied yet */ }
  if (!quiet) await recordActivity(env, "user_renamed", { actor: to, subject: from });
}

// ---- Following -------------------------------------------------------------
// One row per "A follows B", both slugs (migrations/010-follows.sql).
//
// Everything here degrades on a database that has not run that migration yet
// rather than 500ing: there is always a window where this Worker is live and
// the migration is not, and the profile page treats a 503 as "no follow UI".
//
// Deliberately NOT recorded in `activity`. That feed is what changed about the
// coasters and the counts; who is following whom is neither, and a column of
// "Carter followed Cole" would bury the rides.
async function haveFollows(env) {
  try { await env.DB.prepare("SELECT 1 FROM follows LIMIT 1").first(); return true; }
  catch (e) { return false; }
}

async function haveClones(env) {
  try { await env.DB.prepare("SELECT 1 FROM clone_groups LIMIT 1").first(); return true; }
  catch (e) { return false; }
}

// Every group with its members. One query, grouped in JS: there are tens of
// these, not thousands, and two round trips to D1 cost more than the loop.
async function getClones(env) {
  const { results } = await env.DB.prepare(
    "SELECT g.id AS id, g.name AS name, g.note AS note, m.coaster AS coaster " +
    "FROM clone_groups g LEFT JOIN clone_members m ON m.group_id = g.id " +
    "ORDER BY g.id"
  ).all();
  const by = new Map();
  for (const r of results) {
    let g = by.get(r.id);
    if (!g) { g = { id: r.id, name: r.name, note: r.note || "", ids: [] }; by.set(r.id, g); }
    if (r.coaster != null) g.ids.push(r.coaster);
  }
  return [...by.values()];
}

// Coasters that share a name AND a model, which is the only automatic signal
// worth trusting: name alone puts three different rides under "Batman: The
// Ride" (a B&M Invert, a FreeSpin and an SLC) and five under "Goliath", while
// model alone lumps every B&M Invert in the world together. Anything already
// in a group is left out — a suggestion you have answered is not a suggestion.
async function suggestClones(env) {
  const { results } = await env.DB.prepare(
    "SELECT c.id AS id, c.name AS name, c.park AS park, c.model AS model " +
    "FROM coasters c LEFT JOIN clone_members m ON m.coaster = c.id " +
    "WHERE m.coaster IS NULL AND c.name <> '' AND c.model IS NOT NULL AND c.model <> '' " +
    "ORDER BY c.name, c.park"
  ).all();
  const by = new Map();
  for (const c of results) {
    const key = String(c.name).trim().toLowerCase() + " | " + String(c.model).trim();
    if (!by.has(key)) by.set(key, { name: String(c.name).trim(), note: String(c.model).trim(), members: [] });
    by.get(key).members.push({ id: c.id, park: c.park || "" });
  }
  return [...by.values()]
    .filter((g) => g.members.length > 1)
    .sort((a, b) => b.members.length - a.members.length || a.name.localeCompare(b.name));
}

async function haveRiderCats(env) {
  try { await env.DB.prepare("SELECT 1 FROM rider_categories LIMIT 1").first(); return true; }
  catch (e) { return false; }
}

// Everything the ranking page needs to draw one rider's categories, as ONE flat
// list: the site's set and that rider's own, each carrying whether it is
// official, whether they have it switched off, and whether it shows numbers.
//
// The page should not have to know there are two tables. It does need to know
// which is which — an official one is the same on everybody's list, which is
// the whole reason it wears a mark — so that is a field, not a second array.
//
// `c1` is clone_groups id 1 and `r7` is rider_categories id 7: two id spaces
// that would otherwise collide the moment a rider's third category met the
// site's third. Every preference is keyed by that string.
async function getCategories(env, slug) {
  const site = await haveClones(env) ? await getClones(env) : [];
  let own = [], prefs = {};

  if (await haveRiderCats(env)) {
    const { results } = await env.DB.prepare(
      "SELECT c.id AS id, c.name AS name, c.note AS note, m.coaster AS coaster " +
      "FROM rider_categories c LEFT JOIN rider_category_members m ON m.cat_id = c.id " +
      "WHERE c.user_slug = ? ORDER BY c.id"
    ).bind(slug).all();
    const by = new Map();
    for (const r of results) {
      let g = by.get(r.id);
      if (!g) { g = { id: r.id, name: r.name, note: r.note || "", ids: [] }; by.set(r.id, g); }
      if (r.coaster != null) g.ids.push(r.coaster);
    }
    own = [...by.values()];
    const row = await env.DB.prepare(
      "SELECT prefs FROM category_prefs WHERE user_slug = ?").bind(slug).first();
    // A blob somebody hand-edited in the D1 console should not take the ranking
    // page down: unreadable preferences are no preferences.
    if (row && row.prefs) { try { prefs = JSON.parse(row.prefs) || {}; } catch (e) { prefs = {}; } }
  }

  const off = new Set(Array.isArray(prefs.off) ? prefs.off : []);
  const nums = new Set(Array.isArray(prefs.nums) ? prefs.nums : []);
  // Rides that belong to a category but are ranked on their own.
  const pulled = (Array.isArray(prefs.pulled) ? prefs.pulled : [])
    .map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0);
  const dress = (g, key) => ({
    key, id: g.id, name: g.name, note: g.note || "", ids: g.ids,
    official: key.charAt(0) === "c", off: off.has(key), nums: nums.has(key),
  });
  return {
    slug,
    // Off by default would mean nobody ever sees this. On by default with every
    // category still a deliberate choice is the middle: the machinery is ready,
    // and an empty list is what somebody who has chosen nothing gets.
    on: prefs.on !== false,
    pulled,
    categories: site.map((g) => dress(g, "c" + g.id))
      .concat(own.map((g) => dress(g, "r" + g.id))),
  };
}

// Both directions at once, as people rather than slugs — the page shows faces
// and names on both lists, and one query per side here saves it a fetch per
// name. Retried without `avatar` for the same reason getUsers() is: a database
// without migration 008 must still answer.
async function getFollows(env, slug) {
  const SQL = (cols, join, where) =>
    "SELECT " + cols + " FROM follows f JOIN users u ON u.slug = f." + join +
    " WHERE f." + where + " = ? ORDER BY u.name";
  const ask = async (cols) => ({
    followers: (await env.DB.prepare(SQL(cols, "follower", "followee")).bind(slug).all()).results,
    following: (await env.DB.prepare(SQL(cols, "followee", "follower")).bind(slug).all()).results,
  });
  try { return await ask("u.slug AS slug, u.name AS name, u.avatar AS avatar"); }
  catch (e) { return await ask("u.slug AS slug, u.name AS name"); }
}

// ---- Ride log -------------------------------------------------------------
// One shape for every rider:  { user, rides:[{ i, c, d }] }
// One row per ride, each with the row id so an individual mis-tapped ride can
// be deleted, and `d` null when the date is not known. Undated rows sort last:
// they are still credits, they just have no place on a calendar.
async function getRides(env, slug) {
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return null;
  const { results } = await env.DB.prepare(
    "SELECT id, coaster_id, d FROM rides WHERE user_slug = ? ORDER BY d IS NULL, d, id"
  ).bind(slug).all();
  return { user: u.name, rides: results.map(x => ({ i: x.id, c: x.coaster_id, d: x.d })) };
}

// D1 caps bound parameters per statement (SQLITE_MAX_VARIABLE_NUMBER, ~100), so
// any "WHERE id IN (?,?,…)" built from a user's list has to be asked in chunks.
// Both callers below are list-shaped and unbounded in practice — a pasted import
// or a ranking past 100 rides — and an unchunked lookup fails the whole write
// with "too many SQL variables" rather than degrading.
const SQL_VARS = 90;
async function knownCoasterIds(env, ids) {
  const known = new Set();
  for (let i = 0; i < ids.length; i += SQL_VARS) {
    const part = ids.slice(i, i + SQL_VARS);
    const { results } = await env.DB.prepare(
      "SELECT id FROM coasters WHERE id IN (" + part.map(() => "?").join(",") + ")"
    ).bind(...part).all();
    for (const r of results) known.add(r.id);
  }
  return known;
}

// Credits are the headline number (distinct coasters); rides counts the laps.
async function userTotal(env, slug) {
  const t = await env.DB.prepare(
    "SELECT COUNT(DISTINCT coaster_id) AS credits, COUNT(*) AS rides FROM rides WHERE user_slug = ?"
  ).bind(slug).first();
  return t ? { credits: t.credits, rides: t.rides } : { credits: 0, rides: 0 };
}

// Add rides in one batch: { user, d:"YYYY-MM-DD"|null, entries:[{c,n}] }.
//
// Two ways in, one write path. A park day carries a date and a lap count per
// coaster. A list built from memory carries neither: d is null and every entry
// is a single row, because "I have ridden this" is one ride's worth of fact.
// Passing d null is therefore explicit, not a missing field — see the null
// check below, which distinguishes "no date given" from "bad date given".
//
// EVERY coaster id is validated up front and the whole batch is rejected if any
// is unknown — a typo must never half-log a day. Returns {added, total, date}.
// Change a day that is already logged: laps up or down, a coaster off the day,
// a coaster onto it, or the whole day onto another date. Carter's follow-up
// from the day /log shipped, built 2026-09-21.
//
// Rides are one row per lap, so a lap count is a number of rows and editing
// it means making the rows match: fewer wanted than held deletes the newest
// extras, more inserts the difference, a coaster left out of `entries` loses
// every row it had that day. Rows that stay are the SAME rows — nothing is
// deleted and re-inserted — which is what keeps ride ids stable for anything
// holding one, and it is why moving the day is an UPDATE of `d` on the rows
// rather than a copy: the handoff's note on this was right. A move onto a date
// that already has rides merges the two days, which is what "put this on the
// 14th" means when the 14th exists.
//
// `entries` is the whole day as it should be afterwards, not a diff. An empty
// list is allowed and empties the day — with no `to`, that removes it.
async function editDay(env, b) {
  const slug = String(b && b.user || "").toLowerCase();
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return { bad: [400, "no such user"] };
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const d = String(b && b.d || "");
  if (!DAY.test(d)) return { bad: [400, "need d as YYYY-MM-DD"] };
  const to = (b && b.to != null && b.to !== "") ? String(b.to) : null;
  if (to !== null && !DAY.test(to)) return { bad: [400, "need to as YYYY-MM-DD or null"] };
  if (!Array.isArray(b && b.entries)) return { bad: [400, "need entries"] };

  const want = new Map();                        // coaster -> laps wanted
  for (const e of b.entries) {
    const c = Number(e && e.c);
    if (!Number.isInteger(c) || c <= 0) return { bad: [400, "bad coaster id"] };
    let n = Math.round(Number(e && e.n));
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > 50) n = 50;                          // the same laps clamp as addRides
    want.set(c, (want.get(c) || 0) + n);
  }
  const ids = [...want.keys()];
  if (ids.length) {
    const known = await knownCoasterIds(env, ids);
    const unknown = ids.filter(i => !known.has(i));
    if (unknown.length) return { bad: [400, "unknown coaster id(s): " + unknown.join(", ")] };
  }

  const { results: have } = await env.DB.prepare(
    "SELECT id, coaster_id FROM rides WHERE user_slug = ? AND d = ? ORDER BY id"
  ).bind(slug, d).all();
  if (!have.length) return { bad: [404, "no rides on that day"] };
  const held = new Map();                        // coaster -> [row ids], oldest first
  for (const r of have) { if (!held.has(r.coaster_id)) held.set(r.coaster_id, []); held.get(r.coaster_id).push(r.id); }

  const batch = [];
  let added = 0, removed = 0;
  for (const [c, rows] of held) {
    const n = want.get(c) || 0;
    // Newest first off the end: the lap you added by mistake is the one you
    // just added, and the oldest row is the one most likely to be referenced.
    for (const id of rows.slice(n)) { batch.push(env.DB.prepare("DELETE FROM rides WHERE id = ?").bind(id)); removed++; }
  }
  for (const [c, n] of want) {
    const has = (held.get(c) || []).length;
    for (let k = has; k < n; k++) {
      batch.push(env.DB.prepare("INSERT INTO rides (user_slug,coaster_id,d) VALUES (?,?,?)").bind(slug, c, d));
      added++;
    }
  }
  const moved = to !== null && to !== d;
  // After the reconcile, so the new rows move with the day too.
  if (moved) batch.push(env.DB.prepare("UPDATE rides SET d = ? WHERE user_slug = ? AND d = ?").bind(to, slug, d));
  if (batch.length) await env.DB.batch(batch);

  const after = [...want.values()].reduce((a, n) => a + n, 0);
  await recordActivity(env, "day_edited", {
    actor: slug,
    subject: await parkLabel(env, ids.length ? ids : [...held.keys()]),
    n: after,
    detail: { date: d, to: moved ? to : null, added, removed, rides: after, coasters: ids.length },
  });
  // `rides` and `credits` are the rider's TOTALS, from userTotal, the same two
  // numbers every other write reports; the day's own count is `onDay`. Not
  // `rides: after` — that name is taken by the total and the spread would win.
  return { added, removed, moved, onDay: after, coasters: ids.length, ...(await userTotal(env, slug)) };
}

async function addRides(env, b) {
  const slug = String(b && b.user || "").toLowerCase();
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return { bad: [400, "no such user"] };

  // null/absent d = undated. Anything else must be a real date; a malformed
  // string is a bug worth surfacing, not something to silently treat as blank.
  const d = (b && b.d != null && b.d !== "") ? String(b.d) : null;
  if (d !== null && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { bad: [400, "need d as YYYY-MM-DD or null"] };

  const entries = Array.isArray(b && b.entries) ? b.entries : [];
  if (!entries.length) return { bad: [400, "no entries"] };

  const norm = [];
  for (const e of entries) {
    const c = Number(e && e.c);
    if (!Number.isInteger(c) || c <= 0) return { bad: [400, "bad coaster id"] };
    let n = Math.round(Number(e && e.n));
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > 50) n = 50;                       // laps clamp: a typo can't insert 5000 rows
    norm.push({ c: c, n: n });
  }

  const ids = [...new Set(norm.map(e => e.c))];
  const known = await knownCoasterIds(env, ids);
  const unknown = ids.filter(i => !known.has(i));
  if (unknown.length) return { bad: [400, "unknown coaster id(s): " + unknown.join(", ")] };

  const batch = [];
  // One row per lap, so each ride stays individually deletable.
  //
  // An undated entry is only inserted if that coaster has no undated row yet:
  // ticking the same coaster off a list twice means "yes, I have ridden it",
  // not "I rode it twice". Dated rides have no such guard — riding something
  // twice on one day is a real thing to record.
  for (const e of norm) {
    if (d === null) {
      // Laps are unknown, so an undated entry is a single row — and only if
      // the rider has NO row for that coaster yet. "I have ridden this" adds
      // nothing when we already know they have, whether from a logged day or
      // an earlier pass through the list, and inserting anyway would inflate
      // their ride count with a ride that never happened.
      batch.push(env.DB.prepare(
        "INSERT INTO rides (user_slug,coaster_id,d) SELECT ?,?,NULL WHERE NOT EXISTS " +
        "(SELECT 1 FROM rides WHERE user_slug = ? AND coaster_id = ?)"
      ).bind(slug, e.c, slug, e.c));
    } else {
      for (let k = 0; k < e.n; k++) {
        batch.push(env.DB.prepare("INSERT INTO rides (user_slug,coaster_id,d) VALUES (?,?,?)").bind(slug, e.c, d));
      }
    }
  }

  // Credits before the write, so the feed can say how many of these were new
  // to the rider rather than re-rides. Has to be read first — afterwards the
  // difference is unrecoverable.
  const wasCredits = (await userTotal(env, slug)).credits;

  // Count what the database actually wrote rather than what was asked for —
  // the undated guard skips coasters the rider already has, so "added 12" has
  // to mean twelve rows, not twelve ticks.
  const CHUNK = 90;                            // D1 caps statements per batch call
  let inserted = 0;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const res = await env.DB.batch(batch.slice(i, i + CHUNK));
    for (const r of res) inserted += (r.meta && r.meta.changes) || 0;
  }

  const total = await userTotal(env, slug);
  if (inserted) {
    // `bulk` marks a call as part of one import. Somebody's whole count
    // arrives as many calls — one per day they rode, which is what keeps the
    // dates — and each one used to write its own feed line. Nick's 183 credits
    // came in as twenty. (Carter, 2026-09-20: "can you compress it so he
    // 'imported 183 credits' as one line item".)
    if (b && b.bulk) {
      await recordImport(env, slug, { rides: inserted,
                                      credits: total.credits - wasCredits, day: d });
    } else if (d === null) {
      await recordCredits(env, slug, { rides: inserted, coasters: norm.length,
                                       newCredits: total.credits - wasCredits });
    } else {
      await recordActivity(env, "rides", {
        actor: slug,
        subject: await parkLabel(env, ids),
        n: inserted,
        detail: { rides: inserted, coasters: norm.length,
                  newCredits: total.credits - wasCredits, date: d },
      });
    }
  }
  return {
    added: inserted,
    coasters: norm.length,
    total: total.rides,
    credits: total.credits,
    date: d,
  };
}

// ---- Activity feed --------------------------------------------------------
// A plain record of what changed, so five people sharing one password can see
// each other's work. There are no accounts here and this is not an audit log:
// `actor` is whoever the request already identified — the rider picked on /log,
// the slug in a /rankings URL — and it is NULL for the database-editing routes,
// which carry no rider at all. Those read impersonally ("X was added") rather
// than guessing a name, because a wrong name is worse than no name.
//
// Never let this break a write: an activity row is a nice-to-have, the edit is
// not. Every call is wrapped and failures are swallowed.
async function recordActivity(env, kind, { actor = null, subject = null, n = null, detail = null } = {}) {
  try {
    await env.DB.prepare(
      "INSERT INTO activity (at, actor, kind, subject, n, detail) VALUES (?,?,?,?,?,?)"
    ).bind(new Date().toISOString(), actor, kind, subject, n,
           detail == null ? null : JSON.stringify(detail)).run();
  } catch (e) { /* the edit already succeeded; a missing feed row is not worth a 500 */ }
}

// Ranking arrives in bursts. Building a list is fifty small saves — drag one
// coaster, save, drag the next — and one row each turned the feed into a column
// of "Carter ranked 1 new coaster" with the running total ticking up beside it.
// So a ranking event MERGES into this rider's last one while that one is under
// an hour old: the counts add up, the total and the timestamp become the newest,
// and the feed carries a single line that grows as you work.
//
// The merge happens on write rather than on read because the feed is fetched
// with a LIMIT — left alone, one long session would fill the whole page and
// push everyone else's activity off it. `saves` keeps the honest count of how
// many times it was actually saved.
const RANKING_MERGE_MS = 60 * 60 * 1000;
async function recordRanking(env, slug, { added, removed, reordered, credited, total }) {
  const now = new Date().toISOString();
  try {
    const prev = await env.DB.prepare(
      "SELECT id, at, detail FROM activity WHERE kind = 'ranking' AND actor = ? ORDER BY at DESC, id DESC LIMIT 1"
    ).bind(slug).first();
    // A legacy row carrying a bare date parses to midnight and is days old, so
    // it fails this test on its own — no special case needed for it.
    if (prev && Date.parse(now) - Date.parse(prev.at) < RANKING_MERGE_MS) {
      const d = JSON.parse(prev.detail || "{}");
      const merged = {
        added: (d.added || 0) + added,
        removed: (d.removed || 0) + removed,
        reordered: !!(d.reordered || reordered),
        credited: (d.credited || 0) + (credited || 0),
        total: total,                       // the newest total, not a sum
        saves: (d.saves || 1) + 1,
      };
      await env.DB.prepare("UPDATE activity SET at = ?, n = ?, detail = ? WHERE id = ?")
        .bind(now, merged.added || merged.removed || total, JSON.stringify(merged), prev.id).run();
      return;
    }
  } catch (e) { /* fall through and just record it normally */ }
  await recordActivity(env, "ranking", {
    actor: slug, n: added || removed || total,
    detail: { added, removed, reordered, credited: credited || 0, total, saves: 1 },
  });
}

// Adding credits arrives in bursts too, for the same reason ranking does: you
// tick a park's list, save, pick the next park, save again. Six saves in ten
// minutes is one sitting, not six things that happened, and left alone it filled
// the feed with a column of "added 1 coaster to their count".
//
// Merges into this rider's last credits row while that one is under an hour old,
// exactly like recordRanking. DATED rides are deliberately NOT merged: each one
// is a day out at a named park and reads as a fact on its own.
// One import, one line, however many calls it took. Merges into this rider's
// last import for an hour — the same window a ranking or a burst of credits
// already merges over, and for the same reason: the feed is a record of what
// somebody DID, and importing a count is one thing they did.
//
// The days are kept as a list rather than a count so a second call for a date
// already seen does not inflate it; nothing else needs them.
async function recordImport(env, slug, { rides, credits, day }) {
  const now = new Date().toISOString();
  try {
    const prev = await env.DB.prepare(
      "SELECT id, at, n, detail FROM activity WHERE kind = 'import' AND actor = ? ORDER BY at DESC, id DESC LIMIT 1"
    ).bind(slug).first();
    if (prev && Date.parse(now) - Date.parse(prev.at) < RANKING_MERGE_MS) {
      const d = JSON.parse(prev.detail || "{}");
      const days = new Set(Array.isArray(d.days) ? d.days : []);
      if (day) days.add(day);
      const merged = {
        rides: (d.rides || 0) + rides,
        credits: (d.credits || prev.n || 0) + credits,
        days: [...days],
        calls: (d.calls || 1) + 1,
      };
      await env.DB.prepare("UPDATE activity SET at = ?, n = ?, detail = ? WHERE id = ?")
        .bind(now, merged.credits, JSON.stringify(merged), prev.id).run();
      return;
    }
  } catch (e) { /* fall through and record it as its own row */ }
  await recordActivity(env, "import", {
    actor: slug, n: credits,
    detail: { rides: rides, credits: credits, days: day ? [day] : [], calls: 1 },
  });
}

async function recordCredits(env, slug, { rides, coasters, newCredits }) {
  const now = new Date().toISOString();
  try {
    const prev = await env.DB.prepare(
      "SELECT id, at, n, detail FROM activity WHERE kind = 'credits' AND actor = ? ORDER BY at DESC, id DESC LIMIT 1"
    ).bind(slug).first();
    if (prev && Date.parse(now) - Date.parse(prev.at) < RANKING_MERGE_MS) {
      const d = JSON.parse(prev.detail || "{}");
      const merged = {
        rides: (d.rides || prev.n || 0) + rides,
        coasters: (d.coasters || 0) + coasters,
        newCredits: (d.newCredits || 0) + (newCredits || 0),
        date: null,
        saves: (d.saves || 1) + 1,
      };
      await env.DB.prepare("UPDATE activity SET at = ?, n = ?, detail = ? WHERE id = ?")
        .bind(now, merged.rides, JSON.stringify(merged), prev.id).run();
      return;
    }
  } catch (e) { /* fall through and just record it normally */ }
  await recordActivity(env, "credits", {
    actor: slug, n: rides,
    detail: { rides, coasters, newCredits: newCredits || 0, date: null, saves: 1 },
  });
}

// Curation is recorded and not published. Renaming a model, merging two
// spellings of one, moving a handful of rides between them, building or
// deleting a category: every one of those is Carter tidying the shared list,
// and a tidying session is dozens of them. They buried what /changes is for —
// somebody logged rides, a coaster was added, a rider joined — under a column
// of housekeeping nobody reads. (Carter, 2026-09-20: "remove all the category
// changes from /changes it's a lot of clutter", "and all the model name
// changes".)
//
// Excluded in the QUERY, not in the page: filtering after the LIMIT would let
// a curation session eat all 300 rows and leave the feed looking empty. The
// rows stay in `activity` — they are the record of what changed and when, and
// the /qc and admin panes can still read them.
const FEED_HIDDEN = ["clone_set", "clone_removed",
                     "model_renamed", "model_merged", "model_assigned",
                     // "Kumba had 6 details updated" is the same housekeeping
                     // wearing a coaster's name: filling in the specs of rows
                     // nobody had got to yet is a thousand of these, and it is
                     // not what anybody opens /changes to read. A coaster being
                     // ADDED, renamed or merged still shows — those change what
                     // the list IS, not what it says about itself.
                     "coaster_edited"];
async function getActivity(env, limit) {
  const { results } = await env.DB.prepare(
    "SELECT id, at, actor, kind, subject, n, detail FROM activity " +
    "WHERE kind NOT IN (" + FEED_HIDDEN.map(() => "?").join(",") + ") " +
    "ORDER BY at DESC, id DESC LIMIT ?"
  ).bind(...FEED_HIDDEN, limit).all();
  const names = await env.DB.prepare("SELECT slug, name FROM users").all();
  const by = {};
  for (const u of names.results) by[u.slug] = u.name;
  return {
    events: results.map(r => ({
      id: r.id, at: r.at, actor: r.actor, actorName: r.actor ? (by[r.actor] || r.actor) : null,
      kind: r.kind, subject: r.subject, n: r.n,
      detail: r.detail ? JSON.parse(r.detail) : null,
    })),
  };
}

// The park a batch of coasters belongs to, for "logged 5 rides at Kings Island".
// One name when they all share a park, otherwise a count — a day that spans two
// parks is real, and naming only the first would misreport it.
async function parkLabel(env, ids) {
  if (!ids.length) return null;
  const known = new Set();
  for (let i = 0; i < ids.length; i += SQL_VARS) {
    const part = ids.slice(i, i + SQL_VARS);
    const { results } = await env.DB.prepare(
      "SELECT DISTINCT park FROM coasters WHERE id IN (" + part.map(() => "?").join(",") + ")"
    ).bind(...part).all();
    for (const r of results) if (r.park) known.add(r.park);
  }
  const list = [...known];
  return list.length === 1 ? list[0] : (list.length ? list.length + " parks" : null);
}

// ---- Rankings -------------------------------------------------------------
// A rider's personal order of the coasters they've ridden, best first. Stored as
// (user, coaster, pos) with pos 1 = favorite.
//
// Writes are OPEN on purpose. Carter's call (2026-07-30): gating them made his
// own rankings page demand a password to reorder his own list, which is friction
// in exactly the wrong place — ranking is the enjoyable part of the site, and
// the people doing it are the four riders. Logging rides (/log) and adding to
// the shared coaster list (/add) stay gated, because those write data that
// everyone else's pages read.
//
// The exposure, stated plainly: anyone who finds this endpoint can PUT any
// rider's order. Nothing else is reachable through it — it touches only the
// `rankings` table, ride and credit counts are unaffected, and a scrambled order
// is repairable by dragging it back. Set this to true to gate it; the page will
// need its unlock UI back, which is in git history at c27b43b.
const RANKINGS_NEED_TOKEN = false;

async function getRankings(env, slug) {
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return null;
  const { results } = await env.DB.prepare(
    "SELECT coaster_id, pos FROM rankings WHERE user_slug = ? ORDER BY pos"
  ).bind(slug).all();
  // `claimed` drives the page's read-only mode. Without it /rankings had no way
  // to know whose list it was showing, so it offered drag handles and a Save
  // button to everyone and only revealed the truth on a refused save.
  let claimed = false;
  try {
    claimed = !!(await env.DB.prepare("SELECT id FROM accounts WHERE slug = ?").bind(slug).first());
  } catch (e) { /* accounts table not there yet: nothing is claimed */ }
  return { user: u.name, slug: slug, claimed: claimed, order: results.map(r => r.coaster_id) };
}

// Replace a rider's whole list in one shot: { order:[coasterId, ...] }. Doing it
// wholesale keeps add / remove / reorder / head-to-head insert on one code path,
// and means a half-applied reorder can't leave gaps or duplicate positions.
async function putRankings(env, slug, body) {
  const u = await env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();
  if (!u) return { bad: [404, "no such user"] };

  const raw = Array.isArray(body && body.order) ? body.order : null;
  if (!raw) return { bad: [400, "need order: [coasterId, ...]"] };
  if (raw.length > 5000) return { bad: [400, "order too long"] };

  const seen = new Set(), order = [];
  for (const v of raw) {
    const id = Number(v);
    if (!Number.isInteger(id) || id <= 0) return { bad: [400, "bad coaster id: " + v] };
    if (seen.has(id)) continue;            // a coaster can only sit in one place
    seen.add(id); order.push(id);
  }

  if (order.length) {
    const known = await knownCoasterIds(env, order);
    const unknown = order.filter(i => !known.has(i));
    if (unknown.length) return { bad: [400, "unknown coaster id(s): " + unknown.join(", ")] };
  }

  // Read the old order BEFORE replacing it. A PUT carries the whole list, so
  // "what changed" only exists as the difference between the two — and after
  // the DELETE below it is gone. This is what lets the feed say "ranked 20 new
  // coasters" instead of the useless "saved 562 coasters" every single time.
  const prev = await env.DB.prepare(
    "SELECT coaster_id FROM rankings WHERE user_slug = ? ORDER BY pos"
  ).bind(slug).all();
  const before = prev.results.map(r => r.coaster_id);
  const beforeSet = new Set(before);
  const added = order.filter(id => !beforeSet.has(id)).length;
  const removed = before.filter(id => !seen.has(id)).length;
  // Reordered only counts when the list is otherwise the same, so a save that
  // adds rides doesn't also claim a reshuffle it didn't really do.
  const reordered = added === 0 && removed === 0
    && before.some((id, i) => order[i] !== id);

  // The DELETE leads the batch so the replace is atomic within its chunk; the
  // inserts that follow are ordered, so a mid-way failure truncates the list
  // rather than scrambling it. Validation above is what keeps that from
  // happening for the reason it used to (an over-long IN clause).
  const batch = [env.DB.prepare("DELETE FROM rankings WHERE user_slug = ?").bind(slug)];
  order.forEach((id, i) => {
    batch.push(env.DB.prepare("INSERT INTO rankings (user_slug,coaster_id,pos) VALUES (?,?,?)")
      .bind(slug, id, i + 1));
  });
  for (let i = 0; i < batch.length; i += SQL_VARS) await env.DB.batch(batch.slice(i, i + SQL_VARS));

  // Ranking a coaster means you have ridden it, so it becomes a credit.
  //
  // Before this, the two lists could disagree: a rider could rank twenty
  // coasters and still show a count of zero, which is what a new account
  // looked like after its first session with the head-to-head. Nobody ranks a
  // ride they have not been on.
  //
  // It only ever ADDS. Un-ranking something does not delete the credit, and
  // that asymmetry is deliberate: dropping a coaster off your favorites list
  // says something about the ranking, not about whether you rode it, and a
  // reorder must never be able to destroy ride history. Removing a credit
  // stays an explicit act on /log.
  //
  // The rows are undated (d NULL) — the same shape as ticking a coaster off a
  // list there — because a ranking carries no date. A rider who later logs the
  // real day gets a dated row alongside it.
  const credited = await creditRanked(env, slug, order);

  // A save that changed nothing is not news — dragging a row and dropping it
  // back would otherwise fill the feed with noise.
  // Credits earned this way ride along IN the ranking entry rather than as a
  // second row. It is one action by the rider, and two lines saying "ranked 20
  // new coasters" and "added 20 credits" would read as two things happening.
  if (added || removed || reordered || credited) {
    await recordRanking(env, slug,
      { added, removed, reordered, credited, total: order.length });
  }

  return { ok: true, count: order.length, credited: credited };
}

// Give the rider an undated credit for every coaster they have ranked but have
// no ride row for. Returns how many were added.
//
// INSERT ... SELECT ... WHERE NOT EXISTS, so it is idempotent: re-saving the
// same order adds nothing the second time. Chunked because the ids are bound
// parameters and D1 caps those per statement — the same limit that once broke
// Save on a long ranking.
async function creditRanked(env, slug, order) {
  if (!order.length) return 0;
  let added = 0;
  for (let i = 0; i < order.length; i += SQL_VARS) {
    const part = order.slice(i, i + SQL_VARS);
    const batch = part.map(id => env.DB.prepare(
      "INSERT INTO rides (user_slug,coaster_id,d) SELECT ?,?,NULL WHERE NOT EXISTS " +
      "(SELECT 1 FROM rides WHERE user_slug = ? AND coaster_id = ?)"
    ).bind(slug, id, slug, id));
    const res = await env.DB.batch(batch);
    for (const r of res) added += (r && r.meta && r.meta.changes) || 0;
  }
  return added;
}

// ---- Seeding: read the static JSON already in the repo, load into D1 ------
async function fetchAsset(env, url, path) {
  const res = await env.ASSETS.fetch(new URL(path, url).toString());
  if (!res.ok) throw new Error("asset " + path + " -> " + res.status);
  return res.json();
}

async function seed(env, origin) {
  const coasters = (await fetchAsset(env, origin, "/coasters.json")).coasters;
  const parks = await fetchAsset(env, origin, "/parks.json");
  const users = [
    // The riders' current files (2026-09-25; the old ones were frozen copies).
    { slug: "carter", name: "Carter", file: "/crblanchard.json" },
    { slug: "cole",   name: "Cole",   file: "/colegarff.json" },
    { slug: "max",    name: "Max",    file: "/flyingdino.json" },
    { slug: "keltan", name: "Keltan", file: "/bugmonster1.json" },
  ];

  const batch = [];
  const P = (sql, ...b) => batch.push(env.DB.prepare(sql).bind(...b));

  // wipe (idempotent reseed)
  for (const t of ["rides","coasters","parks","users"]) batch.push(env.DB.prepare("DELETE FROM " + t));

  for (const c of coasters) {
    P("INSERT INTO coasters (id,name,park,type,manu,model,h,s,l,inv,dur,laps,yr,opened,openedPrec,closed,closedPrec) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      c.id, c.name??null, c.park??null, c.type??null, c.manu??null, c.model??null,
      c.h??null, c.s??null, c.l??null, c.inv??null, c.dur??null, c.laps??null, c.yr??null,
      c.opened??null, c.openedPrec??null, c.closed??null, c.closedPrec??null);
  }
  for (const [name, p] of Object.entries(parks)) {
    P("INSERT INTO parks (name,lat,lon,region) VALUES (?,?,?,?)", name, p.lat??null, p.lon??null, p.region??null);
  }
  for (const u of users) {
    const data = await fetchAsset(env, origin, u.file);
    P("INSERT INTO users (slug,name,mode,email,created) VALUES (?,?,'rides',?,datetime('now'))", u.slug, data.user || u.name, null);
    for (const r of (data.rides || [])) {
      const c = typeof r === "object" ? r.c : r;
      const d = typeof r === "object" ? (r.d ?? null) : null;
      P("INSERT INTO rides (user_slug,coaster_id,d) VALUES (?,?,?)", u.slug, c, d);
    }
  }
  // D1 batch has a per-call statement cap; chunk it.
  const CHUNK = 90;
  for (let i = 0; i < batch.length; i += CHUNK) {
    await env.DB.batch(batch.slice(i, i + CHUNK));
  }
  return { statements: batch.length, coasters: coasters.length, parks: Object.keys(parks).length };
}

// ---- Geocoding: fill lat/lon for parks referenced by coasters but not yet in
//      the parks table, using OpenStreetMap Nominatim (server-side). ----------
const MISSING_PARKS_COUNT =
  "SELECT COUNT(*) AS n FROM (SELECT DISTINCT park FROM coasters " +
  "WHERE park IS NOT NULL AND park NOT IN (SELECT name FROM parks))";

async function geocodeMissing(env, limit) {
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT park FROM coasters WHERE park IS NOT NULL AND park NOT IN (SELECT name FROM parks) " +
    "ORDER BY RANDOM() LIMIT ?"
  ).bind(limit).all();

  let added = 0; const failed = [];
  for (const row of results) {
    const park = row.park;
    if (!park || park.indexOf("?") >= 0) { failed.push(park); continue; }
    const q = encodeURIComponent(park);
    let lat = null, lon = null;
    try {
      const res = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + q,
        { headers: { "User-Agent": "coasterhub.org park geocoder (carter.r.blanchard@gmail.com)", "Accept": "application/json" } });
      if (res.ok) { const arr = await res.json(); if (arr && arr[0]) { lat = parseFloat(arr[0].lat); lon = parseFloat(arr[0].lon); } }
    } catch (e) {}
    if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
      await env.DB.prepare("INSERT OR REPLACE INTO parks (name,lat,lon,region) VALUES (?,?,?,?)")
        .bind(park, lat, lon, null).run();
      added++;
    } else { failed.push(park); }
    await new Promise(r => setTimeout(r, 1100)); // Nominatim usage policy: <= 1 request/second
  }
  const remain = await env.DB.prepare(MISSING_PARKS_COUNT).first();
  return { ok: true, added: added, failed: failed, remaining: remain.n };
}

// ---- Router ---------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Force HTTPS. Typing "coasterhub.org" gets you http://, and without this
    // the page is served over plain HTTP — Safari then shows "Not Secure" in
    // the address bar. Cloudflare's "Always Use HTTPS" toggle does the same
    // job at the edge; this is here so it holds even if that gets switched off.
    // x-forwarded-proto is what Cloudflare sets; url.protocol is the fallback.
    const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
    if (proto === "http") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    // Avatars come out of R2 rather than the asset bundle, so they are on
    // coasterhub.org like everything else and no third party sees who is
    // looking at whom. Immutable + a year: the key changes on every upload, so
    // a cached picture is never the wrong picture.
    const av = path.match(/^\/avatars\/([A-Za-z0-9._-]{1,120})$/);
    if (av && request.method === "GET") {
      if (!env.AVATARS) return new Response("not found", { status: 404 });
      const obj = await env.AVATARS.get(av[1]);
      if (!obj) return new Response("not found", { status: 404 });
      return new Response(obj.body, {
        headers: {
          "content-type": obj.httpMetadata && obj.httpMetadata.contentType || "image/png",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (!path.startsWith("/api/")) return devSkin(await env.ASSETS.fetch(request), env);
    if (!env.DB) return err(503, "database not bound yet");

    try {
      // Who is signed in, resolved once for the whole request. Skipped entirely
      // when there is no cookie, so the public read paths — which is most
      // traffic — cost no extra query.
      const acct = devAs(env)
        ? await devAccount(env)
        : (cookieToken(request) ? await currentAccount(request, env) : null);

      // ---- public reads ----
      // Aliases ride along with the coaster list rather than living on their own
      // endpoint: every consumer that needs them already fetches this, and it
      // means the static coasters.json fallback carries them too (sync-static
      // writes this response verbatim).
      // One lookup covering all three, before the handlers below read anything.
      if (request.method === "GET" && EDGE_CACHED[path]) {
        const hit = await edgeGet(request);
        if (hit) return hit;
      }
      if (request.method === "GET" && path === "/api/coasters") {
        return edgePut(ctx, request,
          json({ coasters: await getCoasters(env), ...(await getAliases(env)) },
               200, LIST_CACHE));
      }
      if (request.method === "GET" && path === "/api/parks") {
        return edgePut(ctx, request, json(await getParks(env), 200, LIST_CACHE));
      }
      // Which coasters are the same ride. Public and cacheable for the same
      // reason the coaster list is: it changes when Carter curates it, not when
      // anybody rides anything. An empty list before the migration rather than
      // a 503 — a ranking page that cannot collapse clones still works, and
      // failing it would take the whole editor down for a nicety.
      if (request.method === "GET" && path === "/api/clones") {
        if (!await haveClones(env)) return json({ groups: [] }, 200, LIST_CACHE);
        return edgePut(ctx, request, json({ groups: await getClones(env) }, 200, LIST_CACHE));
      }
      // Who exists. Public: the rider pickers and every /user/<slug>/ page read it.
      if (request.method === "GET" && path === "/api/users") return json({ users: await getUsers(env) });
      // Public read: the feed says what changed, never who is allowed to change it.
      if (request.method === "GET" && path === "/api/activity") {
        const n = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500);
        return json(await getActivity(env, n));
      }
      const um = path.match(/^\/api\/user\/([a-z0-9-]+)$/i);
      if (request.method === "GET" && um) {
        const u = await getUser(env, um[1].toLowerCase());
        return u ? json(u) : err(404, "no such user");
      }
      const rm = path.match(/^\/api\/rides\/([a-z0-9-]+)$/i);
      if (request.method === "GET" && rm) {
        const r = await getRides(env, rm[1].toLowerCase());
        return r ? json(r) : err(404, "no such user");
      }
      const km = path.match(/^\/api\/rankings\/([a-z0-9-]+)$/i);
      if (request.method === "GET" && km) {
        const r = await getRankings(env, km[1].toLowerCase());
        return r ? json(r) : err(404, "no such user");
      }
      // Ungated on purpose — see RANKINGS_NEED_TOKEN — *until* the rider has an
      // account. Claiming your rider is what closes your own list: before that
      // it stays as open as it has always been, so the riders who predate
      // accounts do not lose the ability to drag their own order while they wait
      // for an invite. No rider is worse off than yesterday, and every one that
      // claims is better off.
      //
      // A claimed rider's order is theirs ALONE — this is the one write on the
      // site with no admin override, by Carter's call on 2026-09-15 when he
      // found he could reorder someone else's favorites. Everywhere else an
      // admin override earns its keep because the data can need repairing: a
      // mistyped ride, a merged coaster, a park in the wrong place. A ranking
      // cannot be wrong. It is one person's opinion of what they enjoyed, and
      // there is no support request that ends in someone else reordering it.
      // If a list ever genuinely has to be repaired, D1 is still there.
      if (request.method === "PUT" && km) {
        const slug = km[1].toLowerCase();
        const claimed = await haveAccounts(env)
          ? await env.DB.prepare("SELECT id FROM accounts WHERE slug = ?").bind(slug).first()
          : null;
        if (claimed && !(acct && acct.slug === slug)) return err(401, "unauthorized");
        if (RANKINGS_NEED_TOKEN && !tokenOk(request, env)) return err(401, "unauthorized");
        const out = await putRankings(env, km[1].toLowerCase(), await request.json());
        if (out.bad) return err(out.bad[0], out.bad[1]);
        return afterWrite(ctx, env, request, json(out));
      }

      // ---- categories ----------------------------------------------------
      //
      // Two kinds, one endpoint. The site's categories (012) are Carter's and
      // the same for everybody; a rider's own (013) are theirs alone. What a
      // rider may do to the site's is switch it off and pull single rides out
      // of it in their ranking — NOT rename it, NOT change its members. Forking
      // one into a private copy is the thing this deliberately does not allow:
      // two definitions of "Batman: The Ride" means a merge every time the
      // site's changes and no answer to "have you been on more than me".
      //
      // Reading is public, exactly as a ranking is — a category is part of how
      // somebody's list reads, and that list is already open to look at.
      const ctm = path.match(/^\/api\/categories\/([a-z0-9-]+)(?:\/(prefs|\d+))?$/i);
      if (ctm) {
        const slug = ctm[1].toLowerCase();
        const tail = ctm[2] || "";

        if (request.method === "GET" && !tail) {
          const who = await env.DB.prepare("SELECT slug FROM users WHERE slug = ?")
            .bind(slug).first();
          if (!who) return err(404, "no such user");
          return json(await getCategories(env, slug));
        }

        // The same gate a ranking has, for the same reason and by the same
        // 2026-09-15 call: once a rider has claimed their page, what they think
        // of their own rides is theirs, with no admin override. Before they
        // claim it, it is as open as their order already is.
        const claimed = await haveAccounts(env)
          ? await env.DB.prepare("SELECT id FROM accounts WHERE slug = ?").bind(slug).first()
          : null;
        if (claimed && !(acct && acct.slug === slug)) return err(401, "unauthorized");
        if (!await haveRiderCats(env)) return err(503, "run migrations/013-rider-categories.sql first");

        // What is switched off, and what shows numbers. One blob, replaced
        // whole — there is nothing here worth merging field by field.
        if (request.method === "PUT" && tail === "prefs") {
          const b = await request.json();
          const keys = (a) => Array.from(new Set((Array.isArray(a) ? a : [])
            .map((x) => String(x)).filter((x) => /^[cr][0-9]{1,9}$/.test(x)))).slice(0, 500);
          const ids = (a) => Array.from(new Set((Array.isArray(a) ? a : [])
            .map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))).slice(0, 2000);
          const prefs = { on: b && b.on !== false, off: keys(b && b.off),
                          nums: keys(b && b.nums), pulled: ids(b && b.pulled) };
          await env.DB.prepare(
            "INSERT INTO category_prefs (user_slug,prefs,updated) VALUES (?,?,datetime('now')) " +
            "ON CONFLICT(user_slug) DO UPDATE SET prefs = excluded.prefs, updated = excluded.updated"
          ).bind(slug, JSON.stringify(prefs)).run();
          return json({ ok: true, ...prefs });
        }

        // Shared by create and replace. Everything is checked before anything is
        // written: D1 has no transaction across these statements, so whatever
        // can fail has to fail while nothing has moved.
        const readCat = async (b, selfId) => {
          const name = String(b && b.name || "").trim().replace(/\s+/g, " ");
          if (!name) return { bad: err(400, "a category needs a name") };
          if (name.length > 60) return { bad: err(400, "that name is too long") };
          const note = String(b && b.note || "").trim().slice(0, 60);
          const ids = Array.from(new Set((Array.isArray(b && b.ids) ? b.ids : [])
            .map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0)));
          if (ids.length < 2) return { bad: err(400, "a category needs at least two rides") };
          if (ids.length > 200) return { bad: err(400, "that is too many rides for one category") };
          const marks = ids.map(() => "?").join(",");

          const { results: found } = await env.DB.prepare(
            "SELECT id, name, park FROM coasters WHERE id IN (" + marks + ")").bind(...ids).all();
          if (found.length !== ids.length) return { bad: err(404, "one of those rides does not exist") };
          // Named with its park in the refusals below: a clone family is five
          // rides with the SAME name, so "Batman: The Ride is already in Batman:
          // The Ride" tells nobody which one.
          const rideName = (cid) => {
            const c = found.filter((f) => f.id === cid)[0];
            return c ? c.name + (c.park ? " at " + c.park : "") : "that ride";
          };

          // The rule. A ride that is in one of the site's categories cannot be
          // in one of yours — switch that one off and it is an ordinary row
          // again, which is the supported way to disagree with it.
          if (await haveClones(env)) {
            const { results: site } = await env.DB.prepare(
              "SELECT m.coaster AS coaster, g.name AS name FROM clone_members m " +
              "JOIN clone_groups g ON g.id = m.group_id WHERE m.coaster IN (" + marks + ")"
            ).bind(...ids).all();
            if (site.length) {
              return { bad: err(409, rideName(site[0].coaster) + " is in the Coaster Hub " +
                "category \u201c" + site[0].name + "\u201d. Switch that one off first.") };
            }
          }

          const { results: mine } = await env.DB.prepare(
            "SELECT m.coaster AS coaster, c.name AS name FROM rider_category_members m " +
            "JOIN rider_categories c ON c.id = m.cat_id " +
            "WHERE m.user_slug = ? AND m.coaster IN (" + marks + ")" +
            (selfId ? " AND m.cat_id <> ?" : "")
          ).bind(...(selfId ? [slug, ...ids, selfId] : [slug, ...ids])).all();
          if (mine.length) {
            return { bad: err(409, rideName(mine[0].coaster) + " is already in your " +
              "\u201c" + mine[0].name + "\u201d category") };
          }
          return { name, note, ids };
        };

        if (request.method === "POST" && !tail) {
          const g = await readCat(await request.json(), null);
          if (g.bad) return g.bad;
          const id = (await env.DB.prepare(
            "INSERT INTO rider_categories (user_slug,name,note,created) " +
            "VALUES (?,?,?,datetime('now')) RETURNING id"
          ).bind(slug, g.name, g.note || null).first()).id;
          await env.DB.batch(g.ids.map((cid) => env.DB.prepare(
            "INSERT INTO rider_category_members (user_slug,coaster,cat_id) VALUES (?,?,?)")
            .bind(slug, cid, id)));
          return json({ ok: true, key: "r" + id, id, name: g.name, note: g.note, ids: g.ids });
        }

        if (tail && tail !== "prefs" && (request.method === "PUT" || request.method === "DELETE")) {
          const cid = Number(tail);
          const row = await env.DB.prepare(
            "SELECT id, name FROM rider_categories WHERE id = ? AND user_slug = ?")
            .bind(cid, slug).first();
          // Scoped to the slug, so somebody else's category id is a 404 rather
          // than a 403 — there is nothing to learn from the difference.
          if (!row) return err(404, "no such category");

          if (request.method === "DELETE") {
            // Members first: no foreign keys here, so a category deleted on its
            // own would leave rows pointing at nothing and those rides stuck in
            // a category that does not exist.
            await env.DB.prepare("DELETE FROM rider_category_members WHERE cat_id = ? AND user_slug = ?")
              .bind(cid, slug).run();
            await env.DB.prepare("DELETE FROM rider_categories WHERE id = ? AND user_slug = ?")
              .bind(cid, slug).run();
            return json({ ok: true });
          }

          const g = await readCat(await request.json(), cid);
          if (g.bad) return g.bad;
          await env.DB.prepare("UPDATE rider_categories SET name = ?, note = ? WHERE id = ? AND user_slug = ?")
            .bind(g.name, g.note || null, cid, slug).run();
          await env.DB.prepare("DELETE FROM rider_category_members WHERE cat_id = ? AND user_slug = ?")
            .bind(cid, slug).run();
          await env.DB.batch(g.ids.map((c2) => env.DB.prepare(
            "INSERT INTO rider_category_members (user_slug,coaster,cat_id) VALUES (?,?,?)")
            .bind(slug, c2, cid)));
          return json({ ok: true, key: "r" + cid, id: cid, name: g.name, note: g.note, ids: g.ids });
        }
      }

      // ---- following ----
      // Public to read: the counts sit under every bio, including for people
      // who are not signed in.
      const fm = path.match(/^\/api\/follows\/([A-Za-z0-9_-]+)$/);
      if (request.method === "GET" && fm) {
        if (!await haveFollows(env)) return err(503, "run migrations/010-follows.sql first");
        const slug = fm[1].toLowerCase();
        const out = await getFollows(env, slug);
        // Whether the reader can act, answered here rather than left for the
        // button to work out: you cannot follow yourself, and you cannot follow
        // a rider whose page nobody has claimed — there is no one on the other
        // end of it yet. Both relax on their own as people claim their pages.
        const claimed = await haveAccounts(env)
          ? !!await env.DB.prepare("SELECT id FROM accounts WHERE slug = ?").bind(slug).first()
          : false;
        const me = acct && acct.slug || null;
        return json({ slug, followers: out.followers, following: out.following, claimed,
                      me, you: me ? out.followers.some(f => f.slug === me) : false });
      }

      // Follow and unfollow. Needs an account with a rider of its own: this is
      // one rider following another, and the shared admin password is nobody.
      // Sits above the write gate because that gate is admin-shaped and this is
      // the most ordinary thing a signed-in person can do.
      const fw = path.match(/^\/api\/follow\/([A-Za-z0-9_-]+)$/);
      if (fw && (request.method === "POST" || request.method === "DELETE")) {
        if (!await haveFollows(env)) return err(503, "run migrations/010-follows.sql first");
        if (!(acct && acct.slug)) return err(401, "sign in to follow someone");
        const slug = fw[1].toLowerCase();
        if (slug === acct.slug) return err(400, "you cannot follow yourself");
        const them = await env.DB.prepare("SELECT name FROM users WHERE slug = ?").bind(slug).first();
        if (!them) return err(404, "no such rider");
        if (request.method === "POST") {
          const claimed = await env.DB.prepare("SELECT id FROM accounts WHERE slug = ?")
            .bind(slug).first();
          if (!claimed) return err(409, "nobody has claimed that page yet");
          // DO NOTHING, so following twice — two tabs, a double tap — is the
          // same as following once rather than a constraint error.
          await env.DB.prepare(
            "INSERT INTO follows (follower,followee,at) VALUES (?,?,?) ON CONFLICT DO NOTHING")
            .bind(acct.slug, slug, new Date().toISOString()).run();
        } else {
          await env.DB.prepare("DELETE FROM follows WHERE follower = ? AND followee = ?")
            .bind(acct.slug, slug).run();
        }
        // The fresh lists come back with the answer: the page has to redraw the
        // counts and both lists anyway, and a second fetch to do it would show
        // the button flip before the number under it moved.
        const out = await getFollows(env, slug);
        // No afterWrite(): the static JSON snapshots are counts and rankings,
        // and a follow changes neither, so there is nothing to re-sync.
        return json({ ok: true, you: request.method === "POST", slug,
                      followers: out.followers, following: out.following });
      }

      // Bootstrap seed: allowed WITHOUT a token while the DB is still empty, so
      // the site can be populated once right after the D1 binding goes live.
      // After that it requires the admin token like every other write.
      if (request.method === "POST" && path === "/api/admin/seed") {
        const cnt = await env.DB.prepare("SELECT COUNT(*) AS c FROM coasters").first();
        const empty = !cnt || cnt.c === 0;
        if (!empty && !adminOk(request, env, acct)) return err(401, "unauthorized");
        return json({ ok: true, ...(await seed(env, url.origin)) });
      }

      // Geocode parks that have no lat/lon yet (so they plot on the map). Open
      // while parks are still missing coordinates (bootstrap fill); once every
      // referenced park is placed, it requires the admin token.
      if (path === "/api/admin/geocode" && (request.method === "POST" || request.method === "GET")) {
        const miss = await env.DB.prepare(MISSING_PARKS_COUNT).first();
        if ((miss.n || 0) === 0 && !adminOk(request, env, acct)) return err(401, "unauthorized");
        return afterWrite(ctx, env, request, json(await geocodeMissing(env, 10)));
      }

      // ---- accounts ----
      // A clear answer beats a 500 from a missing table in the window between
      // this Worker deploying and the migration being run.
      if (path.startsWith("/api/auth/") && !await haveAccounts(env)) {
        return path === "/api/auth/me"
          ? json({ account: null })        // "nobody is signed in" is true, and every page copes
          : err(503, "accounts are not set up on this deployment yet");
      }

      // Public by necessity: these are how you get a session in the first place,
      // so they sit above the write gate. Each one is individually rate-limited
      // by nothing at all — worth revisiting if the site is ever found by
      // anyone but friends, but D1 writes are the natural brake for now.

      // Who am I? The header and /log ask on every page load, so a signed-out
      // answer is a 200 with a null account, not a 401 — a 401 here would make
      // "not signed in" look like an error in the console on every page.
      if (request.method === "GET" && path === "/api/auth/me") {
        return json({ account: acct && { email: acct.email, slug: acct.slug, name: acct.name,
                                         admin: acct.admin, bio: acct.bio, avatar: acct.avatar } });
      }

      // Sign up. Open to anyone: creating an account also creates the rider it
      // owns, so a new person lands on an empty count of their own rather than
      // anywhere near an existing one.
      if (request.method === "POST" && path === "/api/auth/signup") {
        const b = await request.json();
        const email = String(b && b.email || "").trim().toLowerCase();
        if (!emailOk(email)) return err(400, "that does not look like an email address");
        const problem = passwordProblem(b && b.password);
        if (problem) return err(400, problem);
        const taken = await env.DB.prepare("SELECT id FROM accounts WHERE lower(email) = ?").bind(email).first();
        // Deliberately explicit rather than a vague "could not sign up": the
        // rider list is public anyway, so which emails are registered is not the
        // secret here, and a silent failure is a support conversation.
        if (taken) return err(409, "there is already an account for that email — sign in instead");

        // Hash FIRST. addUser() writes a rider row and an activity entry, and D1
        // has no transaction spanning these statements, so anything that can
        // fail has to fail before the first write — otherwise a signup that
        // breaks halfway leaves a rider nobody owns on the public site. That is
        // not hypothetical: it is what the 210000-iteration bug did.
        let pwHash;
        try { pwHash = await hashPassword(b.password); }
        catch (e) { return err(500, "could not secure that password: " + (e && e.message || e)); }

        const made = await addUser(env, { name: b && b.name, slug: b && b.slug });
        if (made.bad) return err(made.bad[0], made.bad[1]);
        await env.DB.prepare("UPDATE users SET email = ? WHERE slug = ?").bind(email, made.slug).run();
        const acctId = (await env.DB.prepare(
          "INSERT INTO accounts (email,pw,slug,is_admin,created) VALUES (?,?,?,0,datetime('now')) RETURNING id"
        ).bind(email, pwHash, made.slug).first()).id;
        const raw = await startSession(env, acctId);
        return afterWrite(ctx, env, request, json({ ok: true, slug: made.slug, name: made.name },
          200, { "set-cookie": setCookie(raw) }));
      }

      // Sign in.
      if (request.method === "POST" && path === "/api/auth/login") {
        const b = await request.json();
        const email = String(b && b.email || "").trim().toLowerCase();
        const row = await env.DB.prepare(
          "SELECT id, pw, slug FROM accounts WHERE lower(email) = ?").bind(email).first();
        // Verify against a dummy hash when the email is unknown, so "no such
        // account" and "wrong password" take the same time and the response is
        // the same either way.
        const ok = row ? await verifyPassword(String(b && b.password || ""), row.pw)
                       : await verifyPassword("x", DUMMY_HASH);
        if (!row || !ok) return err(401, "wrong email or password");
        await env.DB.prepare("UPDATE accounts SET seen = datetime('now') WHERE id = ?").bind(row.id).run();
        const raw = await startSession(env, row.id);
        return json({ ok: true, slug: row.slug }, 200, { "set-cookie": setCookie(raw) });
      }

      // Sign out. Drops the row as well as the cookie, so a copied cookie from
      // another device stops working too.
      if (request.method === "POST" && path === "/api/auth/logout") {
        const raw = cookieToken(request);
        if (raw) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(await sha256hex(raw)).run();
        return json({ ok: true }, 200, { "set-cookie": clearCookie() });
      }

      // Claim an existing rider with a one-time invite. This is how the riders
      // who predate accounts (and their rides) get a login without anything
      // moving in the database — the account attaches to the slug that is
      // already there.
      if (request.method === "GET" && path === "/api/auth/invite") {
        const inv = await env.DB.prepare(
          "SELECT i.slug AS slug, i.used AS used, u.name AS name FROM invites i " +
          "LEFT JOIN users u ON u.slug = i.slug WHERE i.code = ?"
        ).bind(String(url.searchParams.get("code") || "")).first();
        if (!inv) return err(404, "that invite link is not valid");
        if (inv.used) return err(410, "that invite link has already been used");
        return json({ ok: true, slug: inv.slug, name: inv.name });
      }
      if (request.method === "POST" && path === "/api/auth/claim") {
        const b = await request.json();
        const code = String(b && b.code || "");
        const email = String(b && b.email || "").trim().toLowerCase();
        if (!emailOk(email)) return err(400, "that does not look like an email address");
        const problem = passwordProblem(b && b.password);
        if (problem) return err(400, problem);
        const inv = await env.DB.prepare("SELECT slug, used FROM invites WHERE code = ?").bind(code).first();
        if (!inv) return err(404, "that invite link is not valid");
        if (inv.used) return err(410, "that invite link has already been used");
        const taken = await env.DB.prepare("SELECT id FROM accounts WHERE lower(email) = ?").bind(email).first();
        if (taken) return err(409, "there is already an account for that email — sign in instead");
        const owned = await env.DB.prepare("SELECT id FROM accounts WHERE slug = ?").bind(inv.slug).first();
        if (owned) return err(409, "that rider has already been claimed");
        // The name and username a rider arrives with are PLACEHOLDERS Carter
        // typed to get their count into the site — "Keltan", "@keltan". Claiming
        // is the moment they become somebody's own, so both can be set here and
        // the temporary ones need never be seen (Carter's call, 2026-09-17).
        // Both optional: send neither and nothing moves.
        let wantName = null, wantSlug = null;
        if (b && b.name !== undefined && String(b.name).trim()) {
          wantName = String(b.name).trim().replace(/\s+/g, " ");
          if (wantName.length > 40) return err(400, "that name is too long");
        }
        if (b && b.username !== undefined && String(b.username).trim()) {
          wantSlug = slugify(String(b.username));
          // selfSlug is the rider being claimed, so keeping the existing
          // username is not a clash with itself.
          const bad = await slugProblem(env, wantSlug, inv.slug);
          if (bad) return err(400, bad);
        }

        // Hash FIRST, before anything is written — same rule as signup: D1 has
        // no transaction across these statements, so whatever can fail has to
        // fail while nothing has moved.
        let claimHash;
        try { claimHash = await hashPassword(b.password); }
        catch (e) { return err(500, "could not secure that password: " + (e && e.message || e)); }

        // Rename BEFORE the account is attached. renameRider moves every table
        // that stores a slug — rides, rankings, activity, invites, follows — so
        // doing it first means the account is inserted against the final name
        // and there is no window where the two disagree.
        let slug = inv.slug;
        if (wantSlug && wantSlug !== slug) { await renameRider(env, slug, wantSlug, true); slug = wantSlug; }
        if (wantName) {
          await env.DB.prepare("UPDATE users SET name = ? WHERE slug = ?").bind(wantName, slug).run();
        }

        const acctId = (await env.DB.prepare(
          "INSERT INTO accounts (email,pw,slug,is_admin,created) VALUES (?,?,?,0,datetime('now')) RETURNING id"
        ).bind(email, claimHash, slug).first()).id;
        // Mark the invite spent in the same breath, so a link shared twice by
        // accident cannot make a second account for the same rider.
        await env.DB.prepare("UPDATE invites SET used = datetime('now') WHERE code = ?").bind(code).run();
        await env.DB.prepare("UPDATE users SET email = COALESCE(email, ?) WHERE slug = ?").bind(email, slug).run();
        // The news here is not a new rider — that page has existed for months —
        // it is that the person it is about now owns it.
        const who = await env.DB.prepare("SELECT name FROM users WHERE slug = ?").bind(slug).first();
        await recordActivity(env, "claimed", { actor: slug, subject: who && who.name || slug });
        const raw = await startSession(env, acctId);
        return afterWrite(ctx, env, request, json({ ok: true, slug }, 200, { "set-cookie": setCookie(raw) }));
      }

      // Edit your profile: display name, username, bio — any combination, each
      // optional and independent, so a page can send just the one field it
      // changed.
      //
      // The three are validated differently because they are different kinds of
      // thing. A display name is free text nobody joins on. A username is a
      // public URL and a key in five tables. A bio is a caption with a length
      // limit. Only the username is expensive to change.
      if (request.method === "POST" && path === "/api/account/profile") {
        if (!acct) return err(401, "sign in first");
        const b = await request.json();
        // Admins may edit anyone; everyone else may edit only themselves. Note
        // the REFUSAL rather than a silent fallback to your own row: quietly
        // retargeting "rename ravi" onto the caller renames the wrong person,
        // which is worse than an error, and it is what the first cut did.
        const asked = b && b.slug_of ? String(b.slug_of).toLowerCase() : null;
        if (asked && asked !== acct.slug && !acct.admin) return err(401, "unauthorized");
        const target = asked || acct.slug;
        if (!target) return err(400, "this account is not attached to a rider");
        const who = await env.DB.prepare("SELECT slug, name FROM users WHERE slug = ?").bind(target).first();
        if (!who) return err(404, "no such rider");

        // Bio is optional and independent: sending only a bio leaves the
        // username alone, and an empty string clears it.
        if (b && b.bio !== undefined) {
          const bio = String(b.bio || "").trim().replace(/\s+/g, " ");
          if (bio.length > BIO_MAX) return err(400, "that bio is too long (" + BIO_MAX + " characters max)");
          try {
            await env.DB.prepare("UPDATE users SET bio = ? WHERE slug = ?")
              .bind(bio || null, who.slug).run();
          } catch (e) { return err(503, "run migrations/008-profiles.sql before editing a profile"); }
          if (b.username === undefined && b.name === undefined) {
            return afterWrite(ctx, env, request, json({ ok: true, slug: who.slug, name: who.name,
              bio: bio || null, renamed: false, was: who.slug }));
          }
        }

        // Display name: free text, within reason. NOT required to be unique —
        // two riders both called Dave are two riders called Dave, and the
        // username is what tells them apart.
        if (b && b.name !== undefined) {
          const nm = String(b.name || "").trim().replace(/\s+/g, " ");
          if (!nm) return err(400, "give yourself a name");
          if (nm.length > 40) return err(400, "that name is too long");
          await env.DB.prepare("UPDATE users SET name = ? WHERE slug = ?").bind(nm, who.slug).run();
          who.name = nm;
          if (b.username === undefined) {
            return afterWrite(ctx, env, request, json({ ok: true, slug: who.slug, name: nm,
              renamed: false, was: who.slug }));
          }
        }

        const wanted = String(b && b.username || "").trim();
        if (!wanted) return err(400, "give yourself a username");
        const wantSlug = slugify(wanted);
        const slugBad = await slugProblem(env, wantSlug, who.slug);
        if (slugBad) return err(409, slugBad);

        if (wantSlug !== who.slug) await renameRider(env, who.slug, wantSlug);
        return afterWrite(ctx, env, request, json({ ok: true, slug: wantSlug, name: who.name,
          renamed: wantSlug !== who.slug, was: who.slug }));
      }

      // Forgot your password: ask for a link.
      //
      // ALWAYS answers the same way, whether or not that email has an account.
      // The alternative tells anyone who asks which addresses are registered,
      // and the people it would help most are the ones guessing.
      if (request.method === "POST" && path === "/api/auth/forgot") {
        if (!mailConfigured(env) || !await haveResets(env)) {
          return err(503, "password reset is not set up on this deployment yet");
        }
        const b = await request.json();
        const email = String(b && b.email || "").trim().toLowerCase();
        const sameAnswer = json({ ok: true, sent: true });
        if (!emailOk(email)) return sameAnswer;
        const acc = await env.DB.prepare(
          "SELECT id, email FROM accounts WHERE lower(email) = ?").bind(email).first();
        if (!acc) return sameAnswer;

        const raw = randomToken();
        const now = new Date();
        await env.DB.prepare("INSERT INTO resets (token,account,created,expires) VALUES (?,?,?,?)")
          .bind(await sha256hex(raw), acc.id, now.toISOString(),
                new Date(now.getTime() + RESET_MINUTES * 60000).toISOString()).run();

        const link = url.origin + "/account?reset=" + raw;
        const sent = await sendMail(env, {
          to: acc.email,
          subject: "Reset your Coaster Hub password",
          text: "Someone asked to reset the password for this Coaster Hub account.\n\n"
              + "Set a new one here:\n" + link + "\n\n"
              + "The link works once and expires in " + RESET_MINUTES + " minutes.\n\n"
              + "If this wasn't you, you can ignore this email — nothing has changed, and "
              + "your current password still works.\n",
          action: { href: link, label: "Set a new password" },
        });
        // The sender failing is worth surfacing: the person is staring at a
        // screen that says "check your email" and no email is coming.
        if (sent.bad) return err(502, sent.bad);
        return sameAnswer;
      }

      // Is this reset link still good? The page asks before showing the form,
      // so an expired or spent link says so instead of taking a new password
      // and then refusing it.
      if (request.method === "GET" && path === "/api/auth/reset") {
        if (!await haveResets(env)) return err(503, "password reset is not set up on this deployment yet");
        const raw = String(url.searchParams.get("token") || "");
        if (!raw) return err(400, "no token");
        const row = await env.DB.prepare(
          "SELECT r.expires AS expires, r.used AS used, a.email AS email FROM resets r " +
          "JOIN accounts a ON a.id = r.account WHERE r.token = ?"
        ).bind(await sha256hex(raw)).first();
        if (!row) return err(404, "that reset link is not valid");
        if (row.used) return err(410, "that reset link has already been used");
        if (!(new Date(row.expires) > new Date())) return err(410, "that reset link has expired");
        return json({ ok: true, email: row.email });
      }

      // Set the new password.
      if (request.method === "POST" && path === "/api/auth/reset") {
        if (!await haveResets(env)) return err(503, "password reset is not set up on this deployment yet");
        const b = await request.json();
        const raw = String(b && b.token || "");
        const problem = passwordProblem(b && b.password);
        if (problem) return err(400, problem);
        const hashed = await sha256hex(raw);
        const row = await env.DB.prepare(
          "SELECT account, expires, used FROM resets WHERE token = ?").bind(hashed).first();
        if (!row) return err(404, "that reset link is not valid");
        if (row.used) return err(410, "that reset link has already been used");
        if (!(new Date(row.expires) > new Date())) return err(410, "that reset link has expired");

        let pwHash;
        try { pwHash = await hashPassword(b.password); }
        catch (e) { return err(500, "could not secure that password: " + (e && e.message || e)); }
        await env.DB.prepare("UPDATE accounts SET pw = ? WHERE id = ?").bind(pwHash, row.account).run();
        // Spend this link, and every other outstanding one for the account: if
        // two were requested, the older must not still be a way in.
        await env.DB.prepare("UPDATE resets SET used = datetime('now') WHERE token = ?").bind(hashed).run();
        await env.DB.prepare(
          "UPDATE resets SET used = datetime('now') WHERE account = ? AND used IS NULL")
          .bind(row.account).run();
        // Whoever was signed in is signed out — that is the whole point of a
        // reset when someone else has been in the account.
        await env.DB.prepare("DELETE FROM sessions WHERE account = ?").bind(row.account).run();
        const fresh = await startSession(env, row.account);
        const who = await env.DB.prepare("SELECT slug FROM accounts WHERE id = ?").bind(row.account).first();
        return json({ ok: true, slug: who && who.slug }, 200, { "set-cookie": setCookie(fresh) });
      }

      // Upload your own picture. Raw image body, not multipart: the page has
      // already drawn it to a canvas to crop and shrink it, so what arrives is
      // a small square blob and multipart would only add parsing.
      if (request.method === "POST" && path === "/api/account/avatar") {
        if (!acct) return err(401, "sign in first");
        if (!env.AVATARS) return err(503, "picture uploads are not set up on this deployment yet");
        const asked = acct.admin && url.searchParams.get("slug_of");
        if (asked && asked !== acct.slug && !acct.admin) return err(401, "unauthorized");
        const slug = asked || acct.slug;
        if (!slug) return err(400, "this account is not attached to a rider");

        const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        const ext = AVATAR_TYPES[type];
        if (!ext) return err(400, "that image has to be a PNG, JPEG or WebP");
        const bytes = await request.arrayBuffer();
        if (!bytes.byteLength) return err(400, "that image is empty");
        if (bytes.byteLength > AVATAR_MAX_BYTES) return err(413, "that image is too big");

        // A fresh key every time, so the old picture cannot be served from a
        // cache after someone replaces it — the reason the cache header above
        // can be immutable.
        const key = slug + "-" + randomToken().slice(0, 16) + "." + ext;
        await env.AVATARS.put(key, bytes, { httpMetadata: { contentType: type } });
        const prev = await env.DB.prepare("SELECT avatar FROM users WHERE slug = ?").bind(slug).first();
        try {
          await env.DB.prepare("UPDATE users SET avatar = ? WHERE slug = ?").bind(key, slug).run();
        } catch (e) { return err(503, "run migrations/008-profiles.sql before uploading a picture"); }
        // Best effort: a leftover object costs a fraction of a cent and a
        // failure here must not lose the upload that just succeeded.
        if (prev && prev.avatar) { try { await env.AVATARS.delete(prev.avatar); } catch (e) {} }
        return afterWrite(ctx, env, request, json({ ok: true, avatar: key, url: "/avatars/" + key }));
      }

      // Remove it again, back to the initial in a circle.
      if (request.method === "DELETE" && path === "/api/account/avatar") {
        if (!acct || !acct.slug) return err(401, "sign in first");
        const prev = await env.DB.prepare("SELECT avatar FROM users WHERE slug = ?").bind(acct.slug).first();
        try {
          await env.DB.prepare("UPDATE users SET avatar = NULL WHERE slug = ?").bind(acct.slug).run();
        } catch (e) { return err(503, "run migrations/008-profiles.sql first"); }
        if (env.AVATARS && prev && prev.avatar) { try { await env.AVATARS.delete(prev.avatar); } catch (e) {} }
        return afterWrite(ctx, env, request, json({ ok: true, avatar: null }));
      }

      // Change your own password. Requires the current one: a borrowed session
      // should not be able to lock the owner out of their own count.
      if (request.method === "POST" && path === "/api/auth/password") {
        if (!acct) return err(401, "sign in first");
        const b = await request.json();
        const problem = passwordProblem(b && b.password);
        if (problem) return err(400, problem);
        const row = await env.DB.prepare("SELECT pw FROM accounts WHERE id = ?").bind(acct.id).first();
        if (!row || !await verifyPassword(String(b && b.current || ""), row.pw)) {
          return err(401, "that is not your current password");
        }
        await env.DB.prepare("UPDATE accounts SET pw = ? WHERE id = ?")
          .bind(await hashPassword(b.password), acct.id).run();
        // Every other session for this account dies; the one making the change
        // gets a fresh cookie. This is what makes a password change useful after
        // "I think someone has my login".
        await env.DB.prepare("DELETE FROM sessions WHERE account = ?").bind(acct.id).run();
        const raw = await startSession(env, acct.id);
        return json({ ok: true }, 200, { "set-cookie": setCookie(raw) });
      }

      // ---- rider-owned writes ----
      // These carry their own authorization (mayWriteRider) instead of the
      // blanket admin check below: the whole point of accounts is that Cole can
      // log Cole's day without holding a key to the coaster database.

      // Log a whole park day (see addRides) — used by /log.
      if (request.method === "POST" && path === "/api/rides") {
        const b = await request.json();
        if (!mayWriteRider(request, env, b && b.user, acct)) return err(401, "unauthorized");
        const out = await addRides(env, b);
        if (out.bad) return err(out.bad[0], out.bad[1]);
        return afterWrite(ctx, env, request, json({ ok: true, ...out }));
      }
      // Change a day that is already logged — see editDay. The body names the
      // rider, so it authorizes the same way adding a day does.
      if (request.method === "PUT" && path === "/api/day") {
        const b = await request.json();
        if (!mayWriteRider(request, env, b && b.user, acct)) return err(401, "unauthorized");
        const out = await editDay(env, b);
        if (out.bad) return err(out.bad[0], out.bad[1]);
        return afterWrite(ctx, env, request, json({ ok: true, ...out }));
      }
      // Add a rider's credit — one undated ride, unless they already have the
      // coaster, in which case there is nothing to add.
      if (request.method === "POST" && path === "/api/credit") {
        const b = await request.json();
        if (!b.user || !b.coaster_id) return err(400, "need user + coaster_id");
        if (!mayWriteRider(request, env, b.user, acct)) return err(401, "unauthorized");
        await env.DB.prepare(
          "INSERT INTO rides (user_slug,coaster_id,d) SELECT ?,?,? WHERE NOT EXISTS " +
          "(SELECT 1 FROM rides WHERE user_slug = ? AND coaster_id = ?)"
        ).bind(b.user, b.coaster_id, b.first??null, b.user, b.coaster_id).run();
        return afterWrite(ctx, env, request, json({ ok: true }));
      }
      // Remove a rider's credit — every ride of it, not just one lap.
      if (request.method === "DELETE" && path === "/api/credit") {
        const b = await request.json();
        if (!mayWriteRider(request, env, b && b.user, acct)) return err(401, "unauthorized");
        await env.DB.prepare("DELETE FROM rides WHERE user_slug = ? AND coaster_id = ?").bind(b.user, b.coaster_id).run();
        return afterWrite(ctx, env, request, json({ ok: true }));
      }
      // Undo a single mis-tapped ride (dated ride log only). The owner is on the
      // row, not in the body, so this reads first and authorizes second.
      if (request.method === "DELETE" && path === "/api/ride") {
        const b = await request.json();
        const i = Number(b && b.i);
        if (!Number.isInteger(i) || i <= 0) return err(400, "need i (ride row id)");
        const row = await env.DB.prepare(
          "SELECT r.user_slug AS slug, c.name AS name FROM rides r " +
          "LEFT JOIN coasters c ON c.id = r.coaster_id WHERE r.id = ?"
        ).bind(i).first();
        if (!row) return err(404, "no such ride");
        if (!mayWriteRider(request, env, row.slug, acct)) return err(401, "unauthorized");
        await env.DB.prepare("DELETE FROM rides WHERE id = ?").bind(i).run();
        await recordActivity(env, "ride_removed", { actor: row.slug, subject: row.name });
        return afterWrite(ctx, env, request, json({ ok: true, ...(await userTotal(env, row.slug)) }));
      }

      // ---- writes (auth required) ----
      //
      // Putting a missing coaster or park on the shared list is NOT an admin job
      // (Carter's call, 2026-09-16). An account is enough — the same bar as
      // logging your own rides. A rider who has just ridden something the site
      // has never heard of is exactly who should be able to add it, and making
      // them ask first is how a coaster list falls behind.
      //
      // Only these two, and only creating. Editing and merging what is already
      // there stays admin: /edit rewrites rows every rider's count depends on,
      // and a wrong merge is much harder to notice than a duplicate row.
      const openToAccounts =
        (request.method === "POST" && path === "/api/coaster") ||
        (request.method === "PUT" && path === "/api/park");
      const needsAuth = path.startsWith("/api/admin/") || request.method !== "GET";
      if (needsAuth) {
        const allowed = openToAccounts
          ? (!!acct || tokenOk(request, env))
          : adminOk(request, env, acct);
        if (!allowed) return err(401, "unauthorized");
      }

      // Invite an existing rider to claim their count. Admin only, and it hands
      // back a URL rather than mailing it — there is no mail out of this Worker.
      if (request.method === "POST" && path === "/api/admin/invite") {
        if (!await haveAccounts(env)) return err(503, "run migrations/003-accounts.sql first");
        const b = await request.json();
        const slug = String(b && b.slug || "").toLowerCase();
        const u = await env.DB.prepare("SELECT slug, name FROM users WHERE slug = ?").bind(slug).first();
        if (!u) return err(404, "no such rider");
        const owned = await env.DB.prepare("SELECT id FROM accounts WHERE slug = ?").bind(slug).first();
        if (owned) return err(409, "that rider already has an account");
        const code = randomToken();
        await env.DB.prepare("INSERT INTO invites (code,slug,created) VALUES (?,?,datetime('now'))")
          .bind(code, slug).run();
        return json({ ok: true, slug: slug, name: u.name, url: url.origin + "/account?claim=" + code });
      }

      // ---- clone groups (admin) ------------------------------------------
      //
      // Curated here rather than computed, because no rule gets it right on its
      // own: name alone puts a B&M Invert, a FreeSpin and an SLC under "Batman:
      // The Ride", and model alone makes every B&M Invert one ride. The suggest
      // endpoint proposes name+model families and Carter answers them.
      const CLONE_503 = "run migrations/012-clone-groups.sql first";

      if (request.method === "GET" && path === "/api/admin/categories") {
        if (!await haveRiderCats(env)) return json({ categories: [] });
        const { results } = await env.DB.prepare(
          "SELECT c.id AS id, c.user_slug AS slug, u.name AS who, c.name AS name, " +
          "c.note AS note, c.created AS created, COUNT(m.coaster) AS n " +
          "FROM rider_categories c LEFT JOIN users u ON u.slug = c.user_slug " +
          "LEFT JOIN rider_category_members m ON m.cat_id = c.id " +
          "GROUP BY c.id ORDER BY LOWER(c.name), c.id"
        ).all();
        // How many DIFFERENT riders wrote a category by this name. Two or more
        // and it has stopped being one person's opinion.
        const seen = new Map();
        for (const r of results) {
          const k = String(r.name).trim().toLowerCase();
          if (!seen.has(k)) seen.set(k, new Set());
          seen.get(k).add(r.slug);
        }
        return json({ categories: results.map((r) => ({
          id: r.id, slug: r.slug, who: r.who || r.slug, name: r.name, note: r.note || "",
          n: r.n, riders: seen.get(String(r.name).trim().toLowerCase()).size,
        })) });
      }

      if (request.method === "GET" && path === "/api/admin/clones/suggest") {
        if (!await haveClones(env)) return err(503, CLONE_503);
        return json({ groups: await suggestClones(env) });
      }

      // Shared by create and replace: a group is a name and at least two real
      // coasters, none of which belongs to somebody else's family. Everything is
      // checked before anything is written — D1 has no transaction across these
      // statements, so whatever can fail has to fail while nothing has moved.
      const readGroup = async (b, selfId) => {
        const name = String(b && b.name || "").trim().replace(/\s+/g, " ");
        if (!name) return { bad: err(400, "a group needs a name") };
        if (name.length > 60) return { bad: err(400, "that name is too long") };
        const note = String(b && b.note || "").trim().slice(0, 60);
        const ids = Array.from(new Set((Array.isArray(b && b.ids) ? b.ids : [])
          .map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0)));
        // One coaster is not a family — it is just a coaster, and collapsing it
        // would hide a row behind a disclosure for no reason.
        if (ids.length < 2) return { bad: err(400, "a group needs at least two coasters") };
        const marks = ids.map(() => "?").join(",");
        const { results: found } = await env.DB.prepare(
          "SELECT id FROM coasters WHERE id IN (" + marks + ")").bind(...ids).all();
        if (found.length !== ids.length) return { bad: err(404, "one of those coasters does not exist") };
        const { results: taken } = await env.DB.prepare(
          "SELECT m.coaster AS coaster, g.name AS name FROM clone_members m " +
          "JOIN clone_groups g ON g.id = m.group_id WHERE m.coaster IN (" + marks + ")" +
          (selfId ? " AND m.group_id <> ?" : "")
        ).bind(...(selfId ? [...ids, selfId] : ids)).all();
        if (taken.length) {
          return { bad: err(409, "already in " + taken[0].name + ": coaster " + taken[0].coaster) };
        }
        return { name, note, ids };
      };

      if (request.method === "POST" && path === "/api/clones") {
        if (!await haveClones(env)) return err(503, CLONE_503);
        const g = await readGroup(await request.json(), null);
        if (g.bad) return g.bad;
        const id = (await env.DB.prepare(
          "INSERT INTO clone_groups (name,note,created) VALUES (?,?,datetime('now')) RETURNING id"
        ).bind(g.name, g.note || null).first()).id;
        await env.DB.batch(g.ids.map((cid) => env.DB.prepare(
          "INSERT INTO clone_members (coaster,group_id) VALUES (?,?)").bind(cid, id)));
        await recordActivity(env, "clone_set",
          { subject: g.name, n: g.ids.length, detail: { made: true } });
        return afterWrite(ctx, env, request, json({ ok: true, id, name: g.name, note: g.note, ids: g.ids }));
      }

      const cg = path.match(/^\/api\/clones\/(\d+)$/);
      if (cg && (request.method === "PUT" || request.method === "DELETE")) {
        if (!await haveClones(env)) return err(503, CLONE_503);
        const gid = Number(cg[1]);
        const row = await env.DB.prepare("SELECT id, name FROM clone_groups WHERE id = ?")
          .bind(gid).first();
        if (!row) return err(404, "no such group");

        if (request.method === "DELETE") {
          // Members first: no foreign keys here, so a group deleted on its own
          // would leave its members pointing at nothing and every coaster in it
          // invisible to the suggester forever.
          await env.DB.prepare("DELETE FROM clone_members WHERE group_id = ?").bind(gid).run();
          await env.DB.prepare("DELETE FROM clone_groups WHERE id = ?").bind(gid).run();
          await recordActivity(env, "clone_removed", { subject: row.name });
          return afterWrite(ctx, env, request, json({ ok: true }));
        }

        const g = await readGroup(await request.json(), gid);
        if (g.bad) return g.bad;
        await env.DB.prepare("UPDATE clone_groups SET name = ?, note = ? WHERE id = ?")
          .bind(g.name, g.note || null, gid).run();
        await env.DB.prepare("DELETE FROM clone_members WHERE group_id = ?").bind(gid).run();
        await env.DB.batch(g.ids.map((cid) => env.DB.prepare(
          "INSERT INTO clone_members (coaster,group_id) VALUES (?,?)").bind(cid, gid)));
        await recordActivity(env, "clone_set", { subject: g.name, n: g.ids.length });
        return afterWrite(ctx, env, request, json({ ok: true, id: gid, name: g.name, note: g.note, ids: g.ids }));
      }

      // login check (lets the /edit page validate the password)
      // Reached only once adminOk() has passed, so it answers for an admin
      // ACCOUNT as well as for a correct password — which is what lets /add,
      // /edit and /import skip their gate for someone already signed in.
      if (request.method === "POST" && path === "/api/admin/login") {
        return json({ ok: true, via: tokenOk(request, env) ? "password" : "account" });
      }

      // add a rider, so a new person can be logged/imported the moment they turn
      // up rather than after a code change. They start with no rides at all.
      if (request.method === "POST" && path === "/api/user") {
        const out = await addUser(env, await request.json());
        if (out.bad) return err(out.bad[0], out.bad[1]);
        return afterWrite(ctx, env, request, json(out));
      }

      // create coaster (id = max+1)
      if (request.method === "POST" && path === "/api/coaster") {
        const b = await request.json();
        const row = await env.DB.prepare("SELECT COALESCE(MAX(id),0)+1 AS nid FROM coasters").first();
        const id = row.nid;
        await env.DB.prepare(
          "INSERT INTO coasters (id,name,park,type,manu,model,h,s,l,inv,dur,laps,yr,opened,openedPrec,closed,closedPrec) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        ).bind(id, b.name??null, b.park??null, b.type??"Steel", b.manu??null, b.model??null,
          b.h??null, b.s??null, b.l??null, b.inv??null, b.dur??null, b.laps??1, b.yr??null,
          b.opened??null, b.openedPrec??null, b.closed??null, b.closedPrec??null).run();
        await recordActivity(env, "coaster_added",
          { subject: b.name ?? null, detail: { id: id, park: b.park ?? null } });
        return afterWrite(ctx, env, request, json({ ok: true, id }));
      }

      // update coaster fields
      const cm = path.match(/^\/api\/coaster\/(\d+)$/);
      if (request.method === "PUT" && cm) {
        const id = Number(cm[1]);
        const b = await request.json();
        const sets = [], vals = [];
        for (const f of COASTER_FIELDS) if (f in b) { sets.push(f + " = ?"); vals.push(b[f]); }
        if (!sets.length) return err(400, "no fields");
        // Read the old name BEFORE the update — a rename is the moment a former
        // name exists, and it is unrecoverable afterwards. Read unconditionally
        // now, so an edit that only fills in specs still has a name to report.
        const prev = await env.DB.prepare("SELECT name, park FROM coasters WHERE id = ?").bind(id).first();
        vals.push(id);
        await env.DB.prepare("UPDATE coasters SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
        if ("name" in b && prev && prev.name && prev.name !== b.name) {
          const st = recordAlias(env, id, prev.name, "rename");
          // A name that has become current again is no longer a FORMER name.
          // Without this, renaming A->B->A leaves "A" aliased to a coaster
          // called A, and /add would answer "that's the old name, it's now A".
          const undo = env.DB.prepare(
            "DELETE FROM coaster_aliases WHERE coaster_id = ? AND former_name = ?"
          ).bind(id, b.name);
          await env.DB.batch(st ? [st, undo] : [undo]);
        }
        // A rename is worth naming in the feed; a spec fill-in is just upkeep,
        // so it says which fields moved rather than listing every value.
        if ("name" in b && prev && prev.name && prev.name !== b.name) {
          // The park rides along so /changes can say WHERE it happened: two names
          // and no place is a riddle when the same retheme lands at six parks.
          await recordActivity(env, "coaster_renamed",
            { subject: b.name, detail: { id: id, from: prev.name, park: (b.park ?? prev.park) || null } });
        } else {
          await recordActivity(env, "coaster_edited",
            { subject: (prev && prev.name) || null, n: sets.length,
              detail: { id: id, fields: COASTER_FIELDS.filter(f => f in b) } });
        }
        return afterWrite(ctx, env, request, json({ ok: true }));
      }

      // who still has this coaster — drives the delete button's label in /edit,
      // so you know what you are about to remove before you click it
      const um2 = path.match(/^\/api\/coaster\/(\d+)\/usage$/);
      if (request.method === "GET" && um2) {
        const id = Number(um2[1]);
        const row = await env.DB.prepare("SELECT id, name, park FROM coasters WHERE id = ?").bind(id).first();
        if (!row) return err(404, "no such coaster");
        const { results } = await env.DB.prepare(
          "SELECT r.user_slug AS slug, u.name AS name, COUNT(*) AS rides " +
          "FROM rides r LEFT JOIN users u ON u.slug = r.user_slug " +
          "WHERE r.coaster_id = ? GROUP BY r.user_slug, u.name ORDER BY u.name"
        ).bind(id).all();
        return json({
          id, name: row.name, park: row.park,
          riders: results,
          rides: results.reduce((a, r) => a + r.rides, 0),
        });
      }

      // delete a coaster — refuses while anyone still has it
      //
      // A ride is a fact about a person, so this never cascades. If riders hold
      // the coaster the right move is /api/merge, which moves them onto the
      // surviving row; deleting would silently take credits off their count.
      // The 409 carries the breakdown so the UI can say exactly who.
      if (request.method === "DELETE" && cm) {
        const id = Number(cm[1]);
        const row = await env.DB.prepare("SELECT id, name, park FROM coasters WHERE id = ?").bind(id).first();
        if (!row) return err(404, "no such coaster");
        const { results } = await env.DB.prepare(
          "SELECT r.user_slug AS slug, u.name AS name, COUNT(*) AS rides " +
          "FROM rides r LEFT JOIN users u ON u.slug = r.user_slug " +
          "WHERE r.coaster_id = ? GROUP BY r.user_slug, u.name ORDER BY u.name"
        ).bind(id).all();
        const rides = results.reduce((a, r) => a + r.rides, 0);
        // The rule: a coaster riders hold is merged, not deleted — deleting
        // would take a credit off somebody. The one exception, ?dropRides=1: a
        // thing on the list that is not a roller coaster at all (Berserker and
        // Tiki Twirl at Great America — Carter, 2026-09-21), where the credit
        // was never a credit. Then the rides go with it, and the activity row
        // names every rider whose count just changed and by how much, because
        // that row is the only trace the rides leave.
        const drop = new URL(request.url).searchParams.get("dropRides") === "1";
        if (results.length && !drop) {
          return json({
            error: results.length + " rider" + (results.length === 1 ? "" : "s") +
                   " still have this coaster — merge it instead of deleting it",
            riders: results,
            rides: rides,
          }, 409);
        }
        if (drop && results.length) {
          await env.DB.prepare("DELETE FROM rides WHERE coaster_id = ?").bind(id).run();
        }
        // Belt and braces: the guard above is a separate read, so re-assert it in
        // the statement itself rather than trusting nothing landed in between.
        const res = await env.DB.prepare(
          "DELETE FROM coasters WHERE id = ? AND id NOT IN (SELECT coaster_id FROM rides)"
        ).bind(id).run();
        if (!res.meta || res.meta.changes === 0) return err(409, "coaster is still in use");
        // Its former names go with it — an alias pointing at a deleted id would
        // resolve to nothing and quietly suppress the "not listed" warning. So
        // does every other row keyed by the id: a ranking of it, its place in a
        // category, a clone-group membership.
        await env.DB.prepare("DELETE FROM coaster_aliases WHERE coaster_id = ?").bind(id).run();
        for (const [table, col] of KEYED_BY_COASTER) {
          try { await env.DB.prepare("DELETE FROM " + table + " WHERE " + col + " = ?").bind(id).run(); }
          catch (e) { /* that table is not in this database yet */ }
        }
        const detail = { id: id, park: row.park };
        if (drop && results.length) {
          detail.riders = results.map((r) => ({ slug: r.slug, name: r.name, rides: r.rides }));
          detail.rides = rides;
        }
        await recordActivity(env, "coaster_deleted", { subject: row.name, detail: detail });
        return afterWrite(ctx, env, request, json({
          ok: true, deleted: id, name: row.name, park: row.park,
          dropped: drop && results.length ? { riders: results.length, rides: rides } : null,
        }));
      }

      // merge coaster `from` into `to` (repoints every ride, deletes `from`)
      // Two undated rows for the same rider would collapse into one credit
      // anyway, so the dedupe keeps the table honest rather than changing counts.
      if (request.method === "POST" && path === "/api/merge") {
        const body = await request.json();
        // Numbers, always. SQLite compares a text '137' against an INTEGER
        // column happily enough, so a caller passing ids as strings merged
        // correctly — and then the activity row recorded them as strings,
        // where json_extract hands back text that does not compare equal to an
        // integer id. That is what made the merge unrecoverable for
        // migrations/018, which had to find the survivor by reading that row
        // back. The record is the only trace a merge leaves; it gets one shape.
        const from = Number(body && body.from), to = Number(body && body.to);
        if (!Number.isInteger(from) || !Number.isInteger(to) || !from || !to || from === to) {
          return err(400, "need distinct from/to");
        }
        // The disappearing row's name is a former name of the survivor, and any
        // alias it already carried has to come with it — otherwise merging a
        // coaster silently throws away everything it was ever called.
        const src = await env.DB.prepare("SELECT name, park FROM coasters WHERE id = ?").bind(from).first();

        // Fill the survivor's GAPS from the row that is about to go, the way a
        // park merge already fills its survivor's coordinates.
        //
        // Without this a merge is a spec-shredder, and it does its worst in the
        // case people actually merge: a ride that was rethemed exists twice,
        // once as the old row with every number filled in and once as a stub
        // somebody typed the new name into. Merging the old into the new — the
        // right way round, because the new name is the one that stays — deleted
        // all of it. Carter merged Goliath (Six Flags Fiesta Texas, a B&M
        // Invert with its full specs) into Chupacabra and Chupacabra was left
        // with nothing but "Steel". (2026-09-20.)
        //
        // COALESCE only ever fills a NULL, so nothing the survivor already says
        // about itself is touched, and `name` and `park` are not in the list:
        // the survivor's identity is the whole point of choosing it.
        const MERGE_FILLS = ["type", "manu", "model", "h", "s", "l", "inv", "dur",
                             "laps", "yr", "opened", "openedPrec", "closed", "closedPrec"];
        const fills = MERGE_FILLS.map(
          (c) => c + " = COALESCE(" + c + ", (SELECT " + c + " FROM coasters WHERE id = ?1))"
        ).join(", ");

        const batch = [
          env.DB.prepare("UPDATE coasters SET " + fills + " WHERE id = ?2").bind(from, to),
          env.DB.prepare("UPDATE rides SET coaster_id = ? WHERE coaster_id = ?").bind(to, from),
          env.DB.prepare(
            "DELETE FROM rides WHERE d IS NULL AND id NOT IN " +
            "(SELECT MIN(id) FROM rides WHERE d IS NULL GROUP BY user_slug, coaster_id)"
          ),
          env.DB.prepare("UPDATE OR IGNORE coaster_aliases SET coaster_id = ? WHERE coaster_id = ?").bind(to, from),
          env.DB.prepare("DELETE FROM coaster_aliases WHERE coaster_id = ?").bind(from),
          env.DB.prepare("DELETE FROM coasters WHERE id = ?").bind(from),
        ];
        const rec = src && recordAlias(env, to, src.name, "merge");
        if (rec) batch.unshift(rec);
        await env.DB.batch(batch);

        // Everything else keyed by the coaster that just disappeared.
        //
        // The merge moved the rides and the aliases and nothing else, so a
        // merged coaster silently fell out of its category and out of every
        // ranking holding it. Carter merged Goliath (Fiesta Texas) into
        // Chupacabra and the Batman clones category was left showing "#137" —
        // an id with no coaster behind it — while Chupacabra inherited
        // nothing. (2026-09-20.) Rankings were worse and quieter: the row
        // survives pointing at an id nothing can resolve, so the ride just
        // stops appearing in the list.
        //
        // UPDATE OR IGNORE, then DELETE, one table at a time. OR IGNORE is
        // what decides a collision: the survivor may already be in a category
        // or already ranked by that rider, and then ITS row wins and the dead
        // one is dropped rather than the update failing. Each table gets its
        // own try because several of them belong to migrations a database may
        // not have run yet, and a merge must not fail over a table that is not
        // there.
        for (const [table, col] of KEYED_BY_COASTER) {
          try {
            await env.DB.batch([
              env.DB.prepare("UPDATE OR IGNORE " + table + " SET " + col + " = ? WHERE " + col + " = ?")
                .bind(to, from),
              env.DB.prepare("DELETE FROM " + table + " WHERE " + col + " = ?").bind(from),
            ]);
          } catch (e) { /* that table is not in this database yet */ }
        }
        const dst = await env.DB.prepare("SELECT name, park FROM coasters WHERE id = ?").bind(to).first();
        await recordActivity(env, "coaster_merged", {
          subject: dst ? dst.name : null,
          // The surviving coaster's park, falling back to the one that was
          // merged away — read before the delete, while its row still existed.
          detail: { from: from, to: to, fromName: src ? src.name : null,
                    park: (dst && dst.park) || (src && src.park) || null },
        });
        return afterWrite(ctx, env, request, json({ ok: true }));
      }

      // every park referenced by a coaster, with coords (null = not on the map yet) + coaster count
      // ---- triage -------------------------------------------------------
      //
      // Which coasters have been LOOKED AT and deliberately left out of every
      // category. With clone_members, that is enough to split the whole
      // database three ways — in a category, set aside, not looked at — and
      // the third one is the work queue. A coaster added tomorrow lands there
      // by doing nothing, which is the point.
      if (request.method === "GET" && path === "/api/admin/categories/skipped") {
        try {
          const { results } = await env.DB.prepare(
            "SELECT coaster FROM category_skipped").all();
          return json({ ids: results.map((r) => r.coaster) });
        } catch (e) {
          // Before the migration: nothing is set aside, which is true, and the
          // page still works — it just shows a longer queue.
          return json({ ids: [], need: "015-category-triage.sql" });
        }
      }

      if (request.method === "POST" && path === "/api/admin/categories/skipped") {
        const b = await request.json();
        const ids = Array.from(new Set((Array.isArray(b && b.ids) ? b.ids : [])
          .map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))).slice(0, 500);
        if (!ids.length) return err(400, "which coasters?");
        const marks = ids.map(() => "?").join(",");
        try {
          if (b && b.on === false) {
            await env.DB.prepare(
              "DELETE FROM category_skipped WHERE coaster IN (" + marks + ")").bind(...ids).run();
          } else {
            await env.DB.batch(ids.map((id) => env.DB.prepare(
              "INSERT OR REPLACE INTO category_skipped (coaster,at) VALUES (?,datetime('now'))")
              .bind(id)));
          }
        } catch (e) {
          return err(503, "run migrations/015-category-triage.sql first");
        }
        return json({ ok: true, n: ids.length, on: !(b && b.on === false) });
      }

      // ---- models -------------------------------------------------------
      //
      // Every distinct `model` with how many coasters carry it and which makers
      // build it. A model is free text typed into /add and /edit, so "SLC",
      // "Suspended Looping Coaster" and "Vekoma SLC" are three strings for one
      // thing — which matters twice over now: the shared list reads worse for
      // it, and a category is far easier to assemble by filtering on a model
      // that means what it says.
      if (request.method === "GET" && path === "/api/admin/models") {
        const { results } = await env.DB.prepare(
          "SELECT model, COUNT(*) AS n, COUNT(DISTINCT manu) AS makers, " +
          "  MIN(manu) AS manu, SUM(CASE WHEN closed IS NOT NULL THEN 1 ELSE 0 END) AS gone " +
          "FROM coasters WHERE model IS NOT NULL AND TRIM(model) <> '' " +
          "GROUP BY model ORDER BY n DESC, model"
        ).all();
        const blank = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM coasters WHERE model IS NULL OR TRIM(model) = ''"
        ).first();
        return json({ models: results, blank: (blank && blank.n) || 0 });
      }

      // The models queue's other answer: "I looked at this one and there is no
      // model to give it". Same shape and the same reasoning as
      // category_skipped above — a table of decisions, so a coaster added
      // tomorrow is in the queue by doing nothing, and one that is given a
      // model later leaves it without anything having to tidy up.
      if (request.method === "GET" && path === "/api/admin/models/skipped") {
        try {
          const { results } = await env.DB.prepare(
            "SELECT coaster FROM model_skipped").all();
          return json({ ids: results.map((r) => r.coaster) });
        } catch (e) {
          // Before the migration: nothing is set aside, which is true, and the
          // pane still works — the queue is just longer than it needs to be.
          return json({ ids: [], need: "017-model-triage.sql" });
        }
      }

      if (request.method === "POST" && path === "/api/admin/models/skipped") {
        const b = await request.json();
        const ids = Array.from(new Set((Array.isArray(b && b.ids) ? b.ids : [])
          .map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))).slice(0, 500);
        if (!ids.length) return err(400, "which coasters?");
        const marks = ids.map(() => "?").join(",");
        try {
          if (b && b.on === false) {
            await env.DB.prepare(
              "DELETE FROM model_skipped WHERE coaster IN (" + marks + ")").bind(...ids).run();
          } else {
            await env.DB.batch(ids.map((id) => env.DB.prepare(
              "INSERT OR REPLACE INTO model_skipped (coaster,at) VALUES (?,datetime('now'))")
              .bind(id)));
          }
        } catch (e) {
          return err(503, "run migrations/017-model-triage.sql first");
        }
        return json({ ok: true, n: ids.length, on: !(b && b.on === false) });
      }

      // Rename one model, or merge it into another by renaming it to a name
      // that already exists. One statement either way — the only difference is
      // whether the target was already there, which is what the answer says.
      if (request.method === "POST" && path === "/api/admin/models/rename") {
        const b = await request.json();
        const from = String(b && b.from || "").trim();
        const to = String(b && b.to || "").trim().replace(/\s+/g, " ").slice(0, 60);
        if (!from) return err(400, "which model?");
        if (!to) return err(400, "a model needs a name");
        if (from === to) return err(400, "that is the name it already has");
        const had = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM coasters WHERE model = ?").bind(from).first();
        if (!had || !had.n) return err(404, "no coaster carries that model");
        const into = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM coasters WHERE model = ?").bind(to).first();
        const merged = !!(into && into.n);
        await env.DB.prepare("UPDATE coasters SET model = ? WHERE model = ?").bind(to, from).run();
        await recordActivity(env, merged ? "model_merged" : "model_renamed",
          { subject: to, n: had.n, detail: { from: from } });
        return afterWrite(ctx, env, request, json({ ok: true, from, to, moved: had.n, merged,
                                           total: had.n + ((into && into.n) || 0) }));
      }

      // Move a handful of coasters onto a model, rather than the whole string
      // at once.
      //
      // Rename above answers "every carrier of this name is the same thing and
      // should move together". This is the other half, and it is the bigger
      // half: the three Boomerangs somebody typed as "Vekoma Boomerang" while
      // the other ten say "Boomerang", and the 545 coasters carrying no model
      // at all, which can only ever be sorted a handful at a time. Same UPDATE,
      // a different WHERE.
      if (request.method === "POST" && path === "/api/admin/models/assign") {
        const b = await request.json();
        const ids = Array.from(new Set((Array.isArray(b && b.ids) ? b.ids : [])
          .map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))).slice(0, 500);
        if (!ids.length) return err(400, "which coasters?");
        // An empty model is a real answer — "that is not a model, take it off"
        // — and it is stored as NULL rather than as a blank string: every read
        // tests `IS NULL OR TRIM(model) = ''` and there is no reason to keep
        // both shapes in the column.
        //
        // But it has to be ASKED for. A caller that sends the name under the
        // wrong key, or forgets the field, is not saying "erase it", and this
        // read that as a wipe: /edit's split-by-maker posted `to` instead of
        // `model` and took the model off thirteen Arrow coasters while
        // reporting a successful split. An empty model without `clear` is a
        // 400 now, so that mistake cannot be silent.
        const to = String((b && b.model) || "").trim().replace(/\s+/g, " ").slice(0, 60);
        if (!to && !(b && b.clear === true)) {
          return err(400, "no model given — pass clear:true to take the model off instead");
        }
        // The maker, optionally, in the same write. 544 of the 545 rides
        // carrying no model carry no manufacturer either — they are rows
        // nobody has filled in yet rather than rows missing one field — and
        // Carter is filling both in one pass (2026-09-20: "prob will do
        // manufacturer & model then maybe second pass at a later date to do
        // actual stats"). Two calls per ride would mean two feed rows and two
        // chances to half-save a ride.
        //
        // Only ever SET, never cleared: an empty box is "I am not saying
        // anything about the maker", not "delete what is there". Taking a
        // maker off is the Coasters tab's job, where it is the thing you are
        // looking at.
        const manu = String((b && b.manu) || "").trim().replace(/\s+/g, " ").slice(0, 60);
        const marks = ids.map(() => "?").join(",");
        const had = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM coasters WHERE id IN (" + marks + ")").bind(...ids).first();
        if (!had || !had.n) return err(404, "no such coaster");
        // What is about to CHANGE, not what was asked for: ticking a row that
        // already carries the model is the normal way to use a list like this,
        // and counting it as moved would make the answer a lie.
        const diff = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM coasters WHERE id IN (" + marks + ") " +
          "AND COALESCE(model,'') <> ?").bind(...ids, to).first();
        const into = to ? await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM coasters WHERE model = ?").bind(to).first() : null;
        // The name they came off, for the feed — but only when they all came
        // off the SAME one. Half a dozen models collapsing into one has no
        // "from" to name, and inventing one would be wrong.
        const { results: were } = await env.DB.prepare(
          "SELECT DISTINCT COALESCE(model,'') AS m FROM coasters WHERE id IN (" + marks + ")")
          .bind(...ids).all();
        const from = were.length === 1 ? (were[0].m || null) : null;
        await env.DB.prepare(
          "UPDATE coasters SET model = ?" + (manu ? ", manu = ?" : "") +
          " WHERE id IN (" + marks + ")")
          .bind(...(manu ? [to || null, manu] : [to || null]), ...ids).run();
        const moved = (diff && diff.n) || 0;
        const already = (into && into.n) || 0;
        // Nothing changed — every row already carried it. No feed line for a
        // no-op, and no repo-dispatch either; the answer still says what it
        // found.
        if (moved || manu) {
          await recordActivity(env, "model_assigned", {
            subject: to || null, n: moved,
            detail: { from: from, to: to || null, ids: ids, manu: manu || null,
                    created: !!to && !already },
          });
        }
        // A maker written on its own is still a change worth flushing, even
        // when every ride already carried the model.
        const touched = moved || (manu ? had.n : 0);
        const out = json({ ok: true, model: to || null, manu: manu || null, picked: had.n,
                           moved: moved, created: !!to && !already,
                           total: to ? already + moved : 0 });
        return touched ? afterWrite(ctx, env, request, out) : out;
      }

      // Rename a park, and every coaster standing in it, in one move.
      //
      // Before this there was no such thing as renaming a park: you edited each
      // of its coasters by hand, and nothing recorded that the two names were
      // the same place. So /add would offer to create the park again under its
      // old name, and any URL carrying that name became a dead end. This writes
      // the former name into park_aliases the same way a coaster rename writes
      // one into coaster_aliases, which is what keeps /park/<park> and
      // /park/<park>/<coaster> resolving for both spellings — see findPark and
      // findCoaster in app.js.
      //
      // Modelled on /api/admin/models/rename above, including that renaming
      // ONTO a name that already exists is a merge and is allowed: two
      // spellings of one park is exactly the mess this is for. It says so in
      // the answer, because a merge does not come back by renaming in reverse.
      if (request.method === "POST" && path === "/api/admin/parks/rename") {
        const b = await request.json();
        const from = String(b && b.from || "").trim();
        const to = String(b && b.to || "").trim().replace(/\s+/g, " ").slice(0, 120);
        if (!from) return err(400, "which park?");
        if (!to) return err(400, "a park needs a name");
        if (from === to) return err(400, "that is the name it already has");

        // A park can exist as a row in `parks` with nothing standing in it yet,
        // or as a name on coasters with no row of its own. Either is renameable;
        // neither is a 404 on its own.
        const had = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM coasters WHERE park = ?").bind(from).first();
        const row = await env.DB.prepare("SELECT name FROM parks WHERE name = ?").bind(from).first();
        if ((!had || !had.n) && !row) return err(404, "no such park");

        const into = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM coasters WHERE park = ?").bind(to).first();
        const target = await env.DB.prepare("SELECT name FROM parks WHERE name = ?").bind(to).first();
        const merged = !!(into && into.n) || !!target;

        // The parks row first. Merging keeps the surviving row but fills any gap
        // in it from the one going away — a park being merged INTO may be the
        // one that never got geocoded, and dropping the other's coordinates
        // would quietly lose them.
        if (target && row) {
          await env.DB.prepare(
            "UPDATE parks SET lat = COALESCE(lat, (SELECT lat FROM parks WHERE name = ?1)), " +
            "lon = COALESCE(lon, (SELECT lon FROM parks WHERE name = ?1)), " +
            "region = COALESCE(region, (SELECT region FROM parks WHERE name = ?1)) " +
            "WHERE name = ?2").bind(from, to).run();
          await env.DB.prepare("DELETE FROM parks WHERE name = ?").bind(from).run();
        } else if (row) {
          await env.DB.prepare("UPDATE parks SET name = ? WHERE name = ?").bind(to, from).run();
        }
        await env.DB.prepare("UPDATE coasters SET park = ? WHERE park = ?").bind(to, from).run();

        // Then the aliases, in one batch:
        //  - every former name the old park answered to now points at the new
        //    one, because an alias aimed at a park that no longer exists is a
        //    dead end;
        //  - the old name itself becomes a former name, guarded rather than
        //    INSERT OR IGNOREd because these tables carry no unique constraint
        //    before migrations/016;
        //  - and a name that has become current again stops being a former one,
        //    the same undo a coaster rename does for an A->B->A round trip.
        await env.DB.batch([
          env.DB.prepare("UPDATE park_aliases SET park = ? WHERE park = ?").bind(to, from),
          env.DB.prepare(
            "INSERT INTO park_aliases (park, former_name) SELECT ?1, ?2 WHERE NOT EXISTS " +
            "(SELECT 1 FROM park_aliases WHERE park = ?1 AND former_name = ?2)").bind(to, from),
          env.DB.prepare("DELETE FROM park_aliases WHERE park = ?1 AND former_name = ?1").bind(to),
          env.DB.prepare(
            "DELETE FROM park_aliases WHERE rowid NOT IN " +
            "(SELECT MIN(rowid) FROM park_aliases GROUP BY park, former_name)"),
        ]);

        await recordActivity(env, merged ? "park_merged" : "park_renamed",
          { subject: to, n: (had && had.n) || 0, detail: { from: from } });
        return afterWrite(ctx, env, request, json({ ok: true, from, to, moved: (had && had.n) || 0, merged,
                                           total: ((had && had.n) || 0) + ((into && into.n) || 0) }));
      }

      if (request.method === "GET" && path === "/api/parks-all") {
        const { results } = await env.DB.prepare(
          "SELECT c.park AS name, p.lat AS lat, p.lon AS lon, p.region AS region, COUNT(*) AS coasters " +
          "FROM coasters c LEFT JOIN parks p ON p.name = c.park " +
          "WHERE c.park IS NOT NULL GROUP BY c.park ORDER BY c.park"
        ).all();
        return json({ parks: results });
      }
      // upsert a park's coordinates / region (used by the parks editor)
      if (request.method === "PUT" && path === "/api/park") {
        const b = await request.json();
        if (!b.name) return err(400, "need name");
        // An ordinary account may CREATE the park its new coaster needs, but not
        // touch one that is already on the map: /add sends a name and a region,
        // and a park that exists has both already. So for them the conflict is a
        // no-op rather than an update — nobody moves Cedar Point by adding a
        // coaster to it.
        //
        // For an admin: COALESCE, not a plain overwrite. Adding a park that
        // already exists must never blank its coordinates. The geocoder and the
        // parks editor still set values, they just cannot clear them from here.
        const mayEditExisting = adminOk(request, env, acct);
        await env.DB.prepare(
          "INSERT INTO parks (name,lat,lon,region) VALUES (?,?,?,?) " +
          (mayEditExisting
            ? "ON CONFLICT(name) DO UPDATE SET lat=COALESCE(excluded.lat,lat), " +
              "lon=COALESCE(excluded.lon,lon), region=COALESCE(excluded.region,region)"
            : "ON CONFLICT(name) DO NOTHING")
        ).bind(b.name, b.lat ?? null, b.lon ?? null, b.region ?? null).run();
        return afterWrite(ctx, env, request, json({ ok: true }));
      }

      return err(404, "no such endpoint");
    } catch (e) {
      return err(500, String(e && e.message || e));
    }
  }
};
