/* Coaster Hub's service worker: the pages you have opened still work with no
 * signal (Carter, 2026-10-30, idea 8 — a park is where the signal goes).
 *
 * NETWORK FIRST for pages and for your own data. A copy is kept of every page,
 * script, style sheet and API answer the site sends, but for those it is only
 * used when the network fails, or hangs for 6 seconds with a copy on hand.
 * Two exceptions, for speed (2026-10-31): files with ?v= come straight from
 * the copy (that address never changes), and the big shared lists below are
 * shown from the copy while a fresh one loads for next time.
 *
 * Never kept: anything but GET, other sites, the admin API and sign-in calls
 * (except /api/auth/me, which says who you are on the offline page).
 * Bump CACHE to throw every saved copy away.
 */
var CACHE = "ch-1";
var OFFLINE = "/offline";
var WAIT = 6000;

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.add(OFFLINE); }));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function keep(req) {
  var u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== self.location.origin) return false;
  if (u.pathname === "/sw.js") return false;
  if (u.pathname.indexOf("/api/") === 0) return !/^\/api\/(admin|auth\/(?!me$))/.test(u.pathname);
  return true;
}

// Speed (2026-10-31: "it doesn't feel like a native app when every time you
// navigate through the menu bar it pulls up a basically blank page").
//
// A file whose address carries ?v= never changes at that address (CLAUDE.md:
// the ?v= is bumped with every edit), so it is served from the saved copy
// with no network at all.
function versioned(req) {
  var u = new URL(req.url);
  return u.origin === self.location.origin && u.searchParams.has("v");
}
// The big shared lists every tab waits on: shown from the saved copy at once
// and refreshed behind it, so the next page has the new one. A request made
// with cache:"no-store" — app.js asks that way for a while after you change
// something (wroteLately) — skips this and waits for the network.
// Since the same evening, also each rider's rides, ranking, follows and
// categories, who has ridden a coaster or park, and the feed: every page
// draws from the saved copy at once instead of "freezing for a sec" (Carter,
// 2026-10-31). Someone else's change shows one page view later; your own
// never lags, because for ten minutes after a write you read no-store.
// Not /api/users or /api/user/<slug> (names and pictures, read live), nor
// /api/auth/*.
// Not /api/follows/<slug> either: its answer says who is LOOKING (me, you),
// and a saved copy from an earlier visit hid the Follow button on a profile's
// first open until a reload (Carter, 2026-10-31).
var SHARED = /^\/api\/(coasters|parks|summary|rankings-all|rides-all|activity|coaster-riders|park-riders|(rides|rankings|categories)\/[^\/]+)$/;
function sharedList(req) {
  var u = new URL(req.url);
  return u.origin === self.location.origin && SHARED.test(u.pathname) && req.cache !== "no-store";
}
function save(req, res) {
  if (res && res.ok && res.type === "basic") {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () {});
  }
  return res;
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (!keep(req)) return;
  if (versioned(req)) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        save(req, res);
        // The file's older versions are dead weight now: drop them.
        var u = new URL(req.url);
        caches.open(CACHE).then(function (c) { return c.keys().then(function (ks) {
          ks.forEach(function (k) {
            var o = new URL(k.url);
            if (o.pathname === u.pathname && o.search !== u.search) c.delete(k);
          });
        }); }).catch(function () {});
        return res;
      });
    }));
    return;
  }
  if (sharedList(req)) {
    var fresh = fetch(req).then(function (res) { return save(req, res); });
    e.waitUntil(fresh.catch(function () {}));
    e.respondWith(caches.match(req, { ignoreVary: true }).then(function (hit) {
      return hit || fresh;
    }));
    return;
  }
  e.respondWith(new Promise(function (resolve) {
    var done = false;
    var finish = function (r) { if (!done) { done = true; resolve(r); } };
    var fallback = function () {
      return caches.match(req, { ignoreVary: true }).then(function (hit) {
        return hit || (req.mode === "navigate" ? caches.match(OFFLINE) : Response.error());
      });
    };
    var timer = setTimeout(function () {
      caches.match(req, { ignoreVary: true }).then(function (hit) { if (hit) finish(hit); });
    }, WAIT);
    fetch(req).then(function (res) {
      if (res.ok && res.type === "basic") {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () {});
      }
      clearTimeout(timer); finish(res);
    }).catch(function () {
      clearTimeout(timer);
      // A page fetch can fail for a reason that is not "no signal" — the app's
      // web view interrupting a load on Back, a blip between cell towers —
      // and "No signal" over a page that was one retry away was showing up
      // mid-browse (Carter, 2026-10-31). Pages get one more try first.
      if (req.mode !== "navigate") { fallback().then(finish); return; }
      fetch(req).then(finish, function () { fallback().then(finish); });
    });
  }));
});
