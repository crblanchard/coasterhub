/* Coaster Hub's service worker: the pages you have opened still work with no
 * signal (Carter, 2026-10-30, idea 8 — a park is where the signal goes).
 *
 * NETWORK FIRST, always. A copy is kept of every page, script, style sheet and
 * API answer the site sends, but it is only ever used when the network fails,
 * or hangs for 6 seconds with a copy on hand. Online, nothing here can serve a
 * stale file: the site has been bitten by stale caches before (CLAUDE.md, the
 * old style.css on a home-screen app), and this must never be the next one.
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

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (!keep(req)) return;
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
      fallback().then(finish);
    });
  }));
});
