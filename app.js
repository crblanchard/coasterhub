/* Coaster Hub — shared data engine.
   Loads normalized JSON (coasters + parks + a user's data) and computes
   every stat the site shows. Pure computeStats() is Node-testable.

   Every rider has ONE shape — a list of rides, each with an optional date:

     {user, rides:[{c:"id", d:"YYYY-MM-DD"}, ...]}   // d null = date unknown

   That single shape covers both ways of using the site. Ticking coasters off a
   list leaves one undated row each; logging a park day leaves one dated row per
   lap. Most riders end up with a mix, and the difference is only how much
   detail a given row carries — not a different kind of account.

   The engine reads three INDEPENDENT capabilities off that data and flags each,
   so the UI shows only what is actually supported and dashboards otherwise look
   the same (richer data just adds panels):
     • firstDates  — some rows are dated -> timeline (cumulative + new-per-year)
     • rideCounts  — a re-ride exists    -> total rides, most-ridden, re-ride distance
     • activity    — both of the above   -> calendar heatmap, rides-per-year, biggest days
   None of them is stored; each turns itself on as a rider logs more.
   (Legacy: computeStats may also be called with a bare rides array.) */
(function (global) {
  "use strict";

  var US_STATES = new Set(["Alabama","Alaska","Arizona","Arkansas","California","Colorado",
    "Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
    "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota",
    "Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey",
    "New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon",
    "Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah",
    "Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming",
    "Washington DC","District of Columbia","NorCal","SoCal"]);

  function regionKind(reg) {
    if (reg === "NorCal" || reg === "SoCal") return ["state", "California"];
    // Standardized US locations from the Captain Coaster import: "<State>, US".
    var mUS = /^(.*),\s*US$/.exec(reg || "");
    if (mUS) return ["state", mUS[1]];
    if (US_STATES.has(reg)) return ["state", reg];
    if (reg === "Abu Dhabi" || reg === "Dubai") return ["country", "United Arab Emirates"];
    return ["country", reg];
  }

  function topN(counter, n, keyName, valName) {
    return Object.keys(counter)
      .map(function (k) { var o = {}; o[keyName] = k; o[valName] = counter[k]; return o; })
      .sort(function (a, b) { return b[valName] - a[valName]; })
      .slice(0, n);
  }

  function yearOf(d) { return parseInt(String(d).slice(0, 4), 10); }

  function computeStats(coasters, parks, userInput) {
    var byId = {};
    coasters.forEach(function (c) { byId[c.id] = c; });

    // ---- Normalize any input into: a full dated log (if any), per-credit ride
    // counts (if known), a first-ridden date per credit (if known), the credit
    // set, and the three capability flags. ------------------------------------
    var log = [];            // [{c,d}] — only present with a full dated ride log
    var creditCount = {};    // id -> number of rides (when counts are known)
    var firstRidden = {};    // id -> earliest date string ('YYYY' or 'YYYY-MM-DD')
    var creditSet = {};      // id -> true
    var hasFullLog = false, hasCounts = false;

    // One shape for every rider: rides:[{c, d}], with d null when the date is
    // not known. A credit is a distinct coaster id; first-ridden is the
    // earliest date seen for it. An undated row still counts as a credit —
    // that is what lets someone put their list together without remembering
    // when they rode any of it.
    var ridesInput = Array.isArray(userInput) ? userInput
                   : (userInput && userInput.rides) ? userInput.rides : [];

    ridesInput.forEach(function (r) {
      if (!(r.c in byId)) return;
      creditSet[r.c] = true;
      creditCount[r.c] = (creditCount[r.c] || 0) + 1;
      if (r.d) {
        log.push({ c: r.c, d: r.d });
        if (!firstRidden[r.c] || r.d < firstRidden[r.c]) firstRidden[r.c] = r.d;
      }
    });

    // "Counts are known" means a re-ride has actually been recorded somewhere.
    // A list built by ticking coasters off leaves exactly one row each, which
    // says nothing about how many times they were ridden — so ride totals,
    // miles and airtime stay hidden rather than quietly reporting the floor as
    // if it were the number. A full log needs dates on top of that. Both flip
    // on by themselves as a rider logs more; neither is stored anywhere.
    var creditIds = Object.keys(creditSet);
    hasCounts = ridesInput.length > creditIds.length;
    hasFullLog = hasCounts && log.length > 0;

    var hasFirstDates = Object.keys(firstRidden).length > 0;

    var creditList = creditIds.map(function (id) { return byId[id]; });

    // ---- Timeline aggregates (need first-ridden dates; work for log OR dates) -
    var newByYear = {}, years = new Set();
    Object.keys(firstRidden).forEach(function (id) {
      var y = yearOf(firstRidden[id]);
      if (!isNaN(y)) { newByYear[y] = (newByYear[y] || 0) + 1; years.add(y); }
    });

    // ---- Full-activity aggregates (need every dated ride) --------------------
    var ridesByYear = {}, dayCount = {}, dayParks = {},
        parkRides = {}, visitSet = {}, parkVisitDays = {};
    log.forEach(function (r) {
      var c = byId[r.c];
      var yr = yearOf(r.d); years.add(yr);
      ridesByYear[yr] = (ridesByYear[yr] || 0) + 1;
      dayCount[r.d] = (dayCount[r.d] || 0) + 1;
      (dayParks[r.d] = dayParks[r.d] || {})[c.park] = (dayParks[r.d][c.park] || 0) + 1;
      parkRides[c.park] = (parkRides[c.park] || 0) + 1;
      var vkey = c.park + "|" + r.d;
      if (!visitSet[vkey]) { visitSet[vkey] = true; parkVisitDays[c.park] = (parkVisitDays[c.park] || 0) + 1; }
    });

    var yrMin = null, yrMax = null, yearList = [], cumulative = [];
    if (years.size) {
      yrMin = Math.min.apply(null, [...years]); yrMax = Math.max.apply(null, [...years]);
      for (var y = yrMin; y <= yrMax; y++) yearList.push(y);
      var run = 0; cumulative = yearList.map(function (y) { run += (newByYear[y] || 0); return run; });
    }

    // ---- Collection aggregates (available to everyone) ----------------------
    var steel = 0, wood = 0, manu = {}, loc = {}, uniqueFt = 0, invUnique = 0, parkCredits = {};
    creditList.forEach(function (c) {
      if (c.type === "Wood") wood++; else steel++;
      if (c.manu) manu[c.manu] = (manu[c.manu] || 0) + 1;
      var lreg = parks[c.park] && parks[c.park].region; if (lreg) loc[lreg] = (loc[lreg] || 0) + 1;
      uniqueFt += (c.l || 0); invUnique += (c.inv || 0);
      parkCredits[c.park] = (parkCredits[c.park] || 0) + 1;
    });

    // ---- Ride-count aggregates (need per-credit counts; re-rides included) ---
    var totalRides = 0, distFt = 0, invExp = 0, rideSec = 0;
    if (hasCounts) {
      Object.keys(creditCount).forEach(function (id) {
        var c = byId[id], n = creditCount[id];
        totalRides += n;
        distFt += (c.l || 0) * (c.laps || 1) * n;
        invExp += (c.inv || 0) * (c.laps || 1) * n;
        rideSec += (c.dur || 0) * n;
      });
    }

    var biggest = Object.keys(dayCount).map(function (d) {
      var pk = Object.keys(dayParks[d]).sort(function (a, b) { return dayParks[d][b] - dayParks[d][a]; })[0];
      return { date: d, rides: dayCount[d], park: pk };
    }).sort(function (a, b) { return b.rides - a.rides; }).slice(0, 10);

    function maxBy(list, f) {
      var best = null, bv = -Infinity;
      list.forEach(function (c) { var v = f(c); if (v != null && v > bv) { bv = v; best = c; } });
      return best;
    }
    var curYear = new Date().getFullYear();
    var tallest = maxBy(creditList, function (c) { return c.h; });
    var fastest = maxBy(creditList, function (c) { return c.s; });
    var longest = maxBy(creditList, function (c) { return c.l; });
    var oldest = maxBy(creditList, function (c) { return c.yr ? -c.yr : null; });
    var mostRiddenId = hasCounts
      ? Object.keys(creditCount).sort(function (a, b) { return creditCount[b] - creditCount[a]; })[0]
      : null;
    var mostVisitedPark = hasFullLog
      ? Object.keys(parkVisitDays).sort(function (a, b) { return parkVisitDays[b] - parkVisitDays[a]; })[0]
      : null;

    var dayDetail = {};
    Object.keys(dayCount).forEach(function (d) {
      dayDetail[d] = { t: dayCount[d],
        p: Object.keys(dayParks[d]).map(function (pk) { return [pk, dayParks[d][pk]]; })
              .sort(function (a, b) { return b[1] - a[1]; }) };
    });

    var parksGeo = [];
    Object.keys(parkCredits).forEach(function (pk) {
      // Skip parks we can't place: not in parks.json, or present but not yet
      // geocoded (null lat/lon — e.g. traveling carnivals). Plotting a null
      // coordinate crashes Leaflet and takes down the whole stats page; such
      // parks still count toward their region, they just aren't mapped.
      var g = parks[pk]; if (!g || g.lat == null || g.lon == null) return;
      parksGeo.push({ park: pk, lat: g.lat, lon: g.lon, region: g.region,
        rides: parkRides[pk] || 0, credits: parkCredits[pk] });
    });
    parksGeo.sort(function (a, b) { return (b.rides || b.credits) - (a.rides || a.credits); });

    // Region comes from the coaster's park — the single source of truth for
    // location (one value per park). Coasters whose park isn't in parks.json
    // simply don't contribute a state/country.
    var states = new Set(), countries = new Set();
    creditList.forEach(function (c) {
      var pg = parks[c.park];
      var reg = pg && pg.region; if (!reg) return;
      var kv = regionKind(reg);
      if (kv[0] === "state") states.add(kv[1]); else countries.add(kv[1]);
    });
    var nCountries = countries.size + (states.size ? 1 : 0);

    var topParks = hasFullLog ? topN(parkRides, 12, "park", "val") : topN(parkCredits, 12, "park", "val");

    // First-ridden events with a full (mm-dd) date — powers "on this day".
    var firstRides = Object.keys(firstRidden)
      .filter(function (id) { return String(firstRidden[id]).length >= 10; })
      .map(function (id) { return { c: +id, d: firstRidden[id] }; });

    return {
      // activity  = full dated ride log (unlocks calendar + rides/year + biggest days)
      // timeline  = every credit has a first-ridden date (unlocks cumulative + new/year)
      // firstDates= at least some first-ridden dates exist (unlocks the table column)
      // rideCounts= per-credit ride counts known (unlocks total rides + most-ridden)
      has: {
        activity: hasFullLog,
        timeline: hasFullLog || (hasFirstDates && Object.keys(firstRidden).length === creditList.length),
        firstDates: hasFirstDates,
        rideCounts: hasCounts
      },
      kpi: {
        credits: creditList.length,
        rides: hasCounts ? totalRides : null,
        visits: hasFullLog ? Object.keys(visitSet).length : null,
        steel: steel, wood: wood,
        year_min: yrMin, year_max: yrMax, span: yrMin != null ? yrMax - yrMin + 1 : null,
        parks: parksGeo.length, states: states.size, countries: nCountries,
        miles: hasCounts ? Math.round(distFt / 5280) : null,
        miles_unique: Math.round(uniqueFt / 5280),
        inversions: hasCounts ? invExp : null,
        inversions_unique: invUnique,
        ride_hours: hasCounts ? Math.round(rideSec / 3600) : null
      },
      years: yearList,
      rides_per_year: yearList.map(function (y) { return ridesByYear[y] || 0; }),
      new_credits_per_year: yearList.map(function (y) { return newByYear[y] || 0; }),
      cumulative_credits: cumulative,
      biggest_days: biggest,
      top_parks: topParks,
      top_parks_metric: hasFullLog ? "rides" : "credits",
      top_manufacturers: topN(manu, 10, "name", "credits"),
      top_locations: topN(loc, 12, "loc", "credits"),
      records: {
        tallest: tallest && { name: tallest.name, val: tallest.h, unit: "ft" },
        fastest: fastest && { name: fastest.name, val: fastest.s, unit: "mph" },
        longest: longest && { name: longest.name, val: longest.l, unit: "ft" },
        oldest: oldest && { name: oldest.name, val: curYear - oldest.yr, unit: "yrs" },
        most_ridden: mostRiddenId && { name: byId[mostRiddenId].name, val: creditCount[mostRiddenId], unit: "rides" },
        most_visited_park: mostVisitedPark && { name: mostVisitedPark, val: parkVisitDays[mostVisitedPark], unit: "visits" }
      },
      day_detail: dayDetail,
      first_rides: firstRides,
      geo: { states: [...states].sort(), countries: [...countries].sort(),
             n_states: states.size, n_countries: nCountries, n_parks: parksGeo.length },
      parksGeo: parksGeo,
      byCoaster: (function () {
        var m = {};
        Object.keys(creditSet).forEach(function (id) {
          var dates = log.filter(function (r) { return r.c == id; }).map(function (r) { return r.d; }).sort();
          m[id] = {
            rides: creditCount[id] != null ? creditCount[id] : (dates.length || null),
            first: dates[0] || firstRidden[id] || null,
            last: dates[dates.length - 1] || null, dates: dates
          };
        });
        return m;
      })(),
      coastersById: byId
    };
  }

  // Active user from a pretty path (/user/<name>, /user/<name>/count) or
  // ?user=<name>. Null = the everyone view. The regex stops at the slug, so the
  // bare profile URL and the pages under it both read the same.
  function currentUser() {
    if (typeof location === "undefined") return null;
    var m = location.pathname.match(/\/user\/([^\/]+)/);
    if (m) return decodeURIComponent(m[1]);
    return new URLSearchParams(location.search).get("user");
  }

  // Data loading: prefer the D1-backed API, fall back to the static JSON files
  // (kept in the repo as the seed + a safety net) if the API is unavailable.
  // API first, static snapshot second. The two failures are NOT the same thing
  // and callers need to tell them apart: a 404 from the API with no snapshot
  // behind it means the thing genuinely is not there — a rider who renamed, say,
  // since a rename deletes the old username outright — whereas anything else
  // means we could not reach the data. Without the distinction, a visitor
  // following a stale link used to get advice about running a local web server,
  // because r.json() on the missing snapshot threw a parse error and every
  // failure looked alike.
  // Every API read goes out with cache:"no-store".
  //
  // The Worker sends `cache-control: no-store` now, but a response cached
  // BEFORE it started doing so is still in people's browsers, and heuristic
  // freshness will keep serving it. That is not hypothetical: the riders list
  // kept drawing Carter's previous profile picture — from a cached /api/users
  // naming the old avatar key — while the header, off a different endpoint,
  // showed the new one. Two avatars of the same person on one screen.
  //
  // This asks the browser to skip its HTTP cache for the request itself, so a
  // stale entry cannot be used or revalidated into use, and nobody has to know
  // to hard-refresh. Belt and braces with the header, deliberately: the header
  // stops new stale entries, this gets past the old ones.
  var LIVE = { cache: "no-store" };

  // opts is LIVE for anything per-rider or per-account. The coaster and park
  // lists are deliberately left to the HTTP cache: the Worker gives them an
  // explicit `max-age=300` now, so there is no heuristic guessing to escape,
  // and they are ~900 rows that nearly every page asks for.
  function fetchJSON(apiPath, staticPath, opts) {
    return fetch(apiPath, opts).then(function (r) {
      if (!r.ok) { var e = new Error("api " + r.status); e.status = r.status; throw e; }
      return r.json();
    }).catch(function (apiErr) {
      return fetch(staticPath).then(function (r) {
        if (!r.ok) {
          var gone = !!(apiErr && apiErr.status === 404);
          var e2 = new Error(gone ? "not found" : "could not load data");
          e2.missing = gone;
          throw e2;
        }
        return r.json();
      });
    });
  }
  // The shared list and the park list are the two biggest things any page
  // loads, and more than one part of a page wants them: the home page asked for
  // all 1,114 coasters TWICE on every visit, because index.html fetches them and
  // so does loadUser().
  //
  // Deliberately only while the request is IN FLIGHT. A finished one is dropped,
  // so a page that adds a coaster and asks again gets the new list — /add and
  // /import both do exactly that, and a longer-lived cache would quietly show
  // them the list from before their own edit.
  var inFlight = {};
  // ...and after a write, not even the HTTP cache. The lists carry max-age=300,
  // so a coaster fixed on /edit went on reading the old way on every other page
  // for five minutes (Carter, 2026-09-24: "changes not yet applied to website?
  // please update so things refresh once changes are pushed"). Every page that
  // writes calls noteWrite(), and for ten minutes after one THIS browser reads
  // the lists with no-store. Only the browser that wrote: going no-store for
  // everybody would put the 1,239-row read back on every page view, which is
  // the D1 bill the cache exists to avoid (see EDGE_CACHED in worker.js).
  // Other readers get the change within the five minutes, as before.
  var WROTE_KEY = "ch_wrote", WROTE_FOR = 10 * 60 * 1000;
  function noteWrite() { try { window.localStorage.setItem(WROTE_KEY, String(Date.now())); } catch (e) {} }
  function wroteLately() {
    try { return Date.now() - (+window.localStorage.getItem(WROTE_KEY) || 0) < WROTE_FOR; }
    catch (e) { return false; }
  }
  function shared(key, apiPath, staticPath) {
    if (inFlight[key]) return inFlight[key];
    var p = fetchJSON(apiPath, staticPath, wroteLately() ? LIVE : undefined);
    inFlight[key] = p;
    var done = function () { delete inFlight[key]; };
    p.then(done, done);
    return p;
  }
  function fetchCoasters() { return shared("coasters", "/api/coasters", "/coasters.json"); }
  // The summaries (2026-09-25): one request instead of one per rider. Both
  // resolve to null when the API cannot answer, and the caller falls back to
  // reading each rider's log, which also works from the static files.
  function fetchSummary() {
    return fetch("/api/summary", wroteLately() ? LIVE : undefined)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.users) || null; })
      .catch(function () { return null; });
  }
  function fetchAllRides() {
    return fetch("/api/rides-all", wroteLately() ? LIVE : undefined)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.riders) || null; })
      .catch(function () { return null; });
  }
  function fetchParks() { return shared("parks", "/api/parks", "/parks.json"); }
  function fetchUser(slug) { return fetchJSON("/api/user/" + slug, "/" + slug + ".json", LIVE); }

  // Ride log for one rider: { user, mode, rides:[{i?, c, d, num?, n?}] }.
  // The API returns that shape directly; the static fallback file is the older
  // per-rider shape, so normalise it here and both paths render identically.
  function fetchRides(slug) {
    return fetch("/api/rides/" + slug, LIVE)
      .then(function (r) { if (!r.ok) throw new Error("api " + r.status); return r.json(); })
      .catch(function () {
        return fetch("/" + slug + ".json").then(function (r) { return r.json(); }).then(function (u) {
          if (u.rides) {
            return { user: u.user, mode: "rides",
                     rides: u.rides.map(function (r) { return { c: r.c, d: r.d == null ? null : r.d }; }) };
          }
          return { user: u.user, mode: "credits", rides: (u.credits || []).map(function (c) {
            var o = { c: (typeof c === "object") ? c.c : c, d: null };
            if (typeof c === "object") {
              if (c.first != null) o.d = c.first;
              if (c.num != null) o.num = c.num;
              if (c.n != null) o.n = c.n;
            }
            return o;
          }) };
        });
      });
  }

  function loadUser(userFile) {
    // No rider in the URL means the everyone view (/riders, /count).
    // Kept in step with the seed above when that rider renames.
    if (!userFile) { var u = currentUser(); userFile = u ? u + ".json" : "crblanchard.json"; }
    var slug = userFile.replace(/\.json$/, "");
    return Promise.all([
      fetchCoasters(),
      fetchParks(),
      fetchUser(slug)
    ]).then(function (res) {
      var coasters = res[0].coasters, parks = res[1], user = res[2];
      var stats = computeStats(coasters, parks, user);
      stats.userName = user.user;
      stats.bio = user.bio || null;
      stats.avatar = user.avatar || null;
      // Whether anybody owns this page. The ride TOTALS are hidden until they
      // do — see the note on claimedSlugs() in worker.js. The static fallback
      // file carries no such field, so an offline read is treated as unclaimed,
      // which is the quieter of the two wrong answers.
      stats.claimed = !!user.claimed;
      stats.coasters = coasters;
      stats.parks = parks;
      stats.rides = user.rides || [];
      return stats;
    });
  }

  // ---- Multi-user site config + shared nav --------------------------------
  var USERS = [
    // Seed + offline fallback only: the live list comes from /api/users and
    // REPLACES this (adoptUsers). Kept in step by hand when a rider renames —
    // carter became crblanchard on 2026-09-14, and <slug>.json was renamed with
    // it so the fallback still resolves.
    { slug: "crblanchard",  name: "Carter" },
    { slug: "colegarff",    name: "Cole"   },
    { slug: "bugmonster1",  name: "Keltan Kemp" },
    { slug: "flyingdino",   name: "MaxG"   },
    { slug: "seanpcoakley", name: "Sean"   }
  ];

  // ---- Riders are whoever is in D1, not only the array above ---------------
  // Someone added on /log or /import exists in the database immediately; the
  // array is the seed and the offline fallback. Two things follow:
  //
  //  • The API list is merged into USERS in place, so anything holding the
  //    array (every page's boot code) sees the new rider without a deploy.
  //  • It is cached, because home/riders/count read USERS *synchronously* at
  //    boot — without a cache a new rider would be missing from the page that
  //    triggered the fetch and only appear on the one after. The cache holds
  //    the API's list verbatim, so a rider removed from D1 stops being merged
  //    on the next load rather than sticking around forever.
  var USERS_KEY = "ch_users";
  function escAttr(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  // mergeUsers is additive on purpose — the seed and the cache fill gaps, they
  // never contradict. But the live API is different: when it answers, it is the
  // whole truth, and a rider who has been renamed or removed has to DISAPPEAR.
  // Without this, a renamed rider showed up twice in the picker forever — once
  // from the API under their new slug, once from the stale seed under the old
  // one, both under the same display name.
  //
  // Mutates USERS in place rather than reassigning it: pages hold the array
  // reference (CoasterHub.USERS), so swapping it would leave them on the old one.
  function adoptUsers(list) {
    var fresh = [];
    (list || []).forEach(function (u) {
      if (u && u.slug) fresh.push({ slug: u.slug, name: u.name || u.slug, avatar: u.avatar || null,
                                    claimed: !!u.claimed });
    });
    if (!fresh.length) return;              // never let an empty answer erase the seed
    USERS.length = 0;
    fresh.forEach(function (u) { USERS.push(u); });
  }

  function mergeUsers(list) {
    var have = {}, changed = false;
    USERS.forEach(function (u) { have[u.slug] = u; });
    (list || []).forEach(function (u) {
      if (!u || !u.slug) return;
      if (have[u.slug]) {
        if (u.name && have[u.slug].name !== u.name) { have[u.slug].name = u.name; changed = true; }
        if (u.avatar !== undefined && have[u.slug].avatar !== u.avatar) {
          have[u.slug].avatar = u.avatar; changed = true;
        }
        if (u.claimed !== undefined && have[u.slug].claimed !== !!u.claimed) {
          have[u.slug].claimed = !!u.claimed; changed = true;
        }
        return;
      }
      var rec = { slug: u.slug, name: u.name || u.slug, avatar: u.avatar || null,
                  claimed: !!u.claimed };
      USERS.push(rec); have[u.slug] = rec; changed = true;
    });
    return changed;
  }
  if (typeof window !== "undefined") {
    try {
      var cachedUsers = JSON.parse(window.localStorage.getItem(USERS_KEY) || "null");
      if (Array.isArray(cachedUsers)) mergeUsers(cachedUsers);
    } catch (e) { /* a blocked or corrupt cache just means the built-in list */ }
  }
  // The last rider you looked at is remembered across pages. If that rider has
  // since been renamed away, every nav link would point at a URL that now 404s,
  // and the picker would sit on a name that is not in it. Drop it and fall back
  // to Everyone — which is what the site shows a first-time visitor anyway.
  function forgetUnknownRider() {
    try {
      var remembered = window.localStorage.getItem("ch_rider");
      if (!remembered) return;
      var known = USERS.some(function (u) { return u.slug === remembered; });
      if (!known) window.localStorage.removeItem("ch_rider");
    } catch (e) { /* blocked storage: nothing remembered, nothing to forget */ }
  }

  var usersPromise = null;
  function fetchUsers() {
    if (!usersPromise) {
      usersPromise = fetch("/api/users", LIVE)
        .then(function (r) { if (!r.ok) throw new Error("api " + r.status); return r.json(); })
        .then(function (j) {
          var list = (j && j.users) || [];
          if (!list.length) return USERS;          // never let an empty answer erase the seed
          adoptUsers(list);
          // Overwrite rather than merge, so the cache cannot resurrect a rider
          // the API has stopped listing.
          try { window.localStorage.setItem(USERS_KEY, JSON.stringify(list)); } catch (e) {}
          forgetUnknownRider();
          return USERS;
        })
        .catch(function () { return USERS; });     // offline: the built-in list still works
    }
    return usersPromise;
  }

  // URL for a given person's page. The default user lives at the site root
  // (/riders, /count); everyone else lives under /user/<slug>/.
  // Every link to a rider's page comes through here, so the shape of those URLs
  // is decided in exactly one place.
  //
  // A rider's profile is /user/<slug> — not /user/<slug>/stats (2026-09-16),
  // and profile.html serves it.
  // The page IS the person: it opens with their picture, name and count, and
  // "stats" was a filename showing through. Their other pages keep the suffix
  // because they are pages ABOUT that person: /user/<slug>/count, /rankings.
  // _redirects 301s the old /stats forms here, so existing links still land.
  function userPageHref(slug, page) {
    if (page === "home") return "/";
    // Nobody picked: the page's own everyone view. A profile needs a person, and
    // with nobody signed in the useful answer is the page that gets you one —
    // /account, which bounces a signed-in visitor to their own page anyway.
    // The "count" page's URL says credits (2026-09-25); the key stayed "count"
    // everywhere else, so this is the only place that translates it.
    var seg = page === "count" ? "credits" : page;
    if (!slug) return page === "profile" ? "/account" : "/" + seg;
    return page === "profile" ? "/user/" + slug : "/user/" + slug + "/" + seg;
  }

  // ---- Parks and coasters have URLs too ------------------------------------
  // /park/<park> and /park/<park>/<coaster>.
  //
  // The park leads because a coaster cannot exist without one: chop the last
  // segment off a coaster's URL and you land on its park, which is a page that
  // exists. A flat /coaster/<name> was never on the table — 93 names in the
  // database are used at more than one park ("Wacky Worm" at ten of them) —
  // while the park+coaster pair is unique across all 1,114.
  //
  // This is the only place that knows the shape, for the same reason
  // userPageHref is: build one by hand and it will be the one that rots.

  // Deliberately NOT the same function as slugify() in worker.js, in one
  // respect: an apostrophe is DROPPED here rather than becoming a separator, so
  // Knott's Berry Farm is knotts-berry-farm and not knott-s-berry-farm. That is
  // 27 parks and 51 coasters spelled the way somebody would read them out, and
  // it introduces no collision — the park slugs stay unique, and so do all
  // 1,114 park+coaster pairs.
  //
  // The two can diverge because they are not the same kind of thing. A rider's
  // slug is STORED: it is their identity, a column in five tables and the URL
  // they hand people, so changing the rule that made it would rename existing
  // riders. A park's is DERIVED fresh from its name on every render and owned by
  // nothing, so the rule that makes it can be the better one. Don't "fix" this
  // by making them match again without moving the riders too.
  function slugify(s) {
    return String(s == null ? "" : s).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/['\u2019]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function parkHref(park) { return "/park/" + slugify(park); }
  // A manufacturer's page, /manufacturer/<maker>, and a model's,
  // /manufacturer/<maker>/<model> — derived the same way a park's is, and
  // owned by nothing. (A model was a #card on the maker's page until
  // 2026-09-24; manufacturer.html still opens that card for an old link.)
  function makerHref(manu, model) {
    return "/manufacturer/" + slugify(manu) + (model ? "/" + slugify(model) : "");
  }
  // A location's page: a US state ("Ohio, US" -> /location/ohio-us), a
  // country ("Japan" -> /location/japan), or the whole of the US (/location/us).
  function locationHref(region) { return "/location/" + slugify(region); }
  // A date as Carter reads one: 7/24/2021 (2026-09-25: "make dates show as
  // m/d/yyyy"). A bare year stays a year; anything else comes back as it was.
  function mdy(d) {
    var m = String(d == null ? "" : d).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? (+m[2]) + "/" + (+m[3]) + "/" + m[1] : String(d == null ? "" : d);
  }
  // Takes a coaster row, or a name and a park.
  function coasterHref(c, park) {
    var obj = c && typeof c === "object";
    return "/park/" + slugify(obj ? c.park : park) + "/" + slugify(obj ? c.name : c);
  }

  // ---- ...and a URL resolves back through every rename ----------------------
  // A rename is not an edge case here, it is how this hobby works: a retheme
  // renames the ride, a buyout renames the park, and a relocation moves one to
  // the other. So the database records every former name — coaster_aliases and
  // park_aliases, which ride along with /api/coasters and therefore with the
  // static coasters.json too — and these two functions spend them.
  //
  // The pages do not redirect on what these return. They look up the thing,
  // then compare parkHref/coasterHref of what they found against the URL that
  // was asked for, and replace the address only when the two differ. That way
  // there is one rule — the canonical URL is whatever the current names make —
  // and no path through here can invent a redirect loop.
  function parkWas(list, slug) {
    var pa = (list && list.parkAliases) || [];
    for (var i = 0; i < pa.length; i++) if (slugify(pa[i].n) === slug) return pa[i].p;
    return null;
  }
  // `list` is what fetchCoasters() resolves to: { coasters, aliases, parkAliases }.
  // `parks` is the fetchParks() map, so a park with no coasters on it yet still
  // has a page.
  function findPark(list, parks, slug) {
    var names = Object.create(null), cs = (list && list.coasters) || [], k, i;
    for (k in (parks || {})) names[k] = 1;
    for (i = 0; i < cs.length; i++) if (cs[i].park) names[cs[i].park] = 1;
    for (k in names) if (slugify(k) === slug) return k;
    var was = parkWas(list, slug);
    return (was && names[was]) ? was : null;
  }
  // Four attempts, in the order they are most likely, and each one narrower
  // than a plain name search would be. Returns the coaster row or null.
  function findCoaster(list, parkSlug, nameSlug) {
    var cs = (list && list.coasters) || [], i, c;
    // 1. Both segments as they stand. The overwhelmingly common case.
    for (i = 0; i < cs.length; i++)
      if (slugify(cs[i].park) === parkSlug && slugify(cs[i].name) === nameSlug) return cs[i];
    // 2. The park was renamed and the ride was not — a buyout, a sponsor.
    var pk = parkWas(list, parkSlug);
    if (pk) for (i = 0; i < cs.length; i++)
      if (cs[i].park === pk && slugify(cs[i].name) === nameSlug) return cs[i];
    // 3. The ride was renamed at a park that still has its name — a retheme.
    //    Intimidator at Carowinds is Thunder Striker now, and the old link
    //    should land on it rather than read as a missing coaster.
    var byId = Object.create(null);
    for (i = 0; i < cs.length; i++) byId[cs[i].id] = cs[i];
    var al = (list && list.aliases) || [], elsewhere = [];
    for (i = 0; i < al.length; i++) {
      if (slugify(al[i].n) !== nameSlug) continue;
      c = byId[al[i].c];
      if (!c) continue;
      if (slugify(c.park) === parkSlug || (pk && c.park === pk)) return c;
      if (elsewhere.indexOf(c) < 0) elsewhere.push(c);
    }
    // 4. Nothing in the URL's park matched. A ride that moved — a relocation,
    //    or a park rename nobody recorded — is still findable by name alone,
    //    but ONLY where the name picks out exactly one ride: "wacky-worm" is
    //    ten different coasters and guessing between them is worse than a 404.
    var byName = cs.filter(function (x) { return slugify(x.name) === nameSlug; });
    if (byName.length === 1) return byName[0];
    if (!byName.length && elsewhere.length === 1) return elsewhere[0];
    return null;
  }
  // Every former name this coaster has worn, for the line that says so.
  //
  // Minus the ones that are the current name in different punctuation. Seventeen
  // of the table's aliases are exactly that — "Flash: Vertical Velocity*" under
  // Flash: Vertical Velocity, "Rollies Coaster" under Rollie's Coaster — because
  // they came in from imports that spelled it differently, not from a rename.
  // They are real and they still resolve; they are just not news, and printing
  // "Formerly Flash: Vertical Velocity" on Flash: Vertical Velocity reads as a
  // bug. Same slug, same name as far as a URL is concerned.
  function formerNames(list, id, current) {
    var now = slugify(current);
    return ((list && list.aliases) || [])
      .filter(function (a) { return a.c === id && slugify(a.n) !== now; })
      .map(function (a) { return a.n; });
  }

  // The pages that exist per rider, i.e. everything but Home. Used for both
  // the header links and the rider picker so the two can't disagree.
  // Pages that belong to one rider and take a /user/<slug>/ prefix. Add new is
  // deliberately absent: it edits the shared database, so it reads the same
  // whoever is looking at it.
  var PER_RIDER = ["count", "profile", "rankings", "map"];

  // Wire the header for a page ("home" | "profile" | "riders" | "count" |
  // "rankings"): point the per-rider links at the current person, mark the
  // active link, and render the rider picker (alphabetical).
  // ---- Theme ---------------------------------------------------------------
  // Dark is the default and the only thing the CSS renders without help, so a
  // visitor who has never touched the toggle gets the right page with no JS at
  // all. Only "light" is ever stored; anything else (or a blocked localStorage)
  // falls back to dark rather than guessing.
  //
  // The system preference is deliberately NOT consulted: Carter asked for dark
  // unless you hit the toggle, and honouring prefers-color-scheme would hand a
  // light page to everyone whose laptop is in light mode — the opposite.
  var THEME_KEY = "ch_theme";
  function readTheme() {
    try { return window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"; }
    catch (e) { return "dark"; }
  }
  function applyTheme(t) {
    var el = document.documentElement;
    if (t === "light") el.setAttribute("data-theme", "light");
    else el.removeAttribute("data-theme");
    // Colour the browser's own chrome (iOS status bar, Android address bar) to
    // match, or a light page keeps a dark notch above it.
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "theme-color");
      document.head.appendChild(m);
    }
    m.setAttribute("content", t === "light" ? "#f5f5f3" : "#111315");

    // Anything painted with JS rather than CSS — Chart.js canvases, Leaflet
    // markers — has to be told, or it keeps the palette it was built with.
    try {
      el.dispatchEvent(new CustomEvent("ch:themechange", { detail: { theme: t } }));
    } catch (e) { /* CustomEvent is everywhere we support; never block the toggle */ }
  }

  var SUN = '<path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4'
          + 'M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>';
  var MOON = '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>';

  // `atStart` is true only inside the #people group, where the toggle sits to
  // the left of "Viewing <rider>". Log and Add have no picker, so there it is
  // appended to the nav instead — prepending put it left of the wordmark and
  // shoved the whole brand into the middle of the header.
  // ---- who is signed in ----------------------------------------------------
  // One request per page load, shared by everything that asks. The answer is
  // deliberately NOT cached in localStorage: a stale "you are Cole" would put
  // the wrong name on the log button and hide the sign-in link from someone
  // whose session has since expired.
  var mePromise = null;
  function me() {
    if (!mePromise) {
      mePromise = fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : { account: null }; })
        .then(function (d) { return (d && d.account) || null; })
        .catch(function () { return null; });   // offline, or the API is down
    }
    return mePromise;
  }

  // The header's account control: your initial when signed in, a person outline
  // when not. Both go to /account — one to manage it, one to make one.
  var PERSON = '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0"/>';
  function buildAccountLink(wrap) {
    var a = document.createElement("a");
    a.className = "acctlink";
    a.href = "/account";
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + PERSON + "</svg>";
    a.setAttribute("aria-label", "Sign in");
    a.setAttribute("title", "Sign in");
    wrap.appendChild(a);
    me().then(function (acct) {
      if (!acct) return;
      var label = acct.name || acct.slug || acct.email;
      // Signed in, this goes to your own profile: that is where the account
      // lives now, and /account only holds the signed-out forms.
      if (acct.slug) a.href = userPageHref(acct.slug, "profile");
      a.className = "acctlink on";
      a.setAttribute("aria-label", "Signed in as " + label);
      a.setAttribute("title", "Signed in as " + label);
      if (acct.avatar) {
        // The picture fills the circle the initial would have sat in, so the
        // control keeps its size and place in the header either way.
        a.innerHTML = "";
        a.style.backgroundImage = 'url("/avatars/' + acct.avatar + '")';
        a.style.backgroundSize = "cover";
        a.style.backgroundPosition = "center";
        return;
      }
      a.textContent = String(label).trim().charAt(0).toUpperCase();
    });
  }

  function buildThemeToggle(wrap, atStart) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "themetoggle";
    b.innerHTML = '<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + MOON + '</svg>'
      + '<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + SUN + '</svg>';
    function label() {
      var next = readTheme() === "light" ? "dark" : "light";
      b.setAttribute("aria-label", "Switch to " + next + " mode");
      b.setAttribute("title", "Switch to " + next + " mode");
    }
    label();
    b.addEventListener("click", function () {
      var next = readTheme() === "light" ? "dark" : "light";
      try { window.localStorage.setItem(THEME_KEY, next); } catch (e) {}
      applyTheme(next);
      label();
    });
    if (atStart) wrap.insertBefore(b, wrap.firstChild);
    else wrap.appendChild(b);
  }

  // The rider switcher, worn as the hero badge.
  //
  // It used to be a "Viewing <name>" pill in the header. Two controls answering
  // "whose page is this?" — a pill top right and a badge over the headline —
  // was one too many, and the header one was the one nobody looked at: the
  // answer belongs beside the words it changes (Carter's call, 2026-09-17).
  //
  // Global is only offered where there IS an everyone view. /count and
  // /rankings both have one; a profile is one person by definition, so its
  // menu is riders only.
  // /count lost its everyone view on 2026-09-25 (it is /coasters and /parks now).
  var GLOBAL_PAGES = { rankings: 1 };

  function riderBadge(host, page, slug) {
    if (!host || typeof document === "undefined") return;
    slug = slug || "";

    var wrap = document.createElement("div");
    wrap.className = "riderbadge";
    if (host.id) wrap.id = host.id;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "badge pick";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    var label = document.createElement("span");
    btn.appendChild(label);
    // A chevron, because a badge has been decoration everywhere else on the
    // site and nothing about this one otherwise says there is a list behind it.
    btn.insertAdjacentHTML("beforeend",
      '<svg class="rbarrow" viewBox="0 0 24 24" width="12" height="12" fill="none"'
      + ' stroke="currentColor" stroke-width="3" stroke-linecap="round"'
      + ' stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>');

    var menu = document.createElement("div");
    menu.className = "rbmenu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");

    wrap.appendChild(btn);
    host.parentNode.replaceChild(wrap, host);
    // The MENU lives at the end of <body>, not inside the badge.
    //
    // `.hero` is `overflow:hidden` (it clips its own gradients and the track
    // SVG), so a menu absolutely positioned inside it is clipped at the hero's
    // bottom edge. On a desktop the hero is tall enough to hide the problem; on
    // a phone — more so since the hero padding was tightened — the list was cut
    // off mid-way and the last rider could not be reached or scrolled to at all.
    // Exactly the trap profile-edit.js records for the crop dialog: nesting
    // something that has to escape its parent inside a box that clips.
    document.body.appendChild(menu);

    function nameFor(s) {
      if (!s) return "Global";
      for (var i = 0; i < USERS.length; i++) if (USERS[i].slug === s) return USERS[i].name;
      return s;                           // the list has not arrived yet
    }
    function item(value, text, on) {
      return '<button type="button" role="menuitem" class="rbitem' + (on ? " on" : "")
        + '" data-v="' + escAttr(value) + '">' + escAttr(text) + "</button>";
    }
    // Refilled rather than rebuilt: this runs once before the rider list has
    // loaded, so the badge reads something immediately, and again once it has.
    //
    // Global is PINNED above the scroll rather than being the first row in it.
    // It is not one of the riders — it is the way out of looking at a rider —
    // and at seven riders it had already scrolled off the top of its own menu,
    // which is the one thing it exists to not do.
    function fill() {
      label.textContent = nameFor(slug);
      var rows = USERS.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
      menu.innerHTML =
        (GLOBAL_PAGES[page] ? '<div class="rbpin">' + item("__all__", "Global", !slug) + "</div>" : "")
        + '<div class="rbscroll">'
        + rows.map(function (u) { return item(u.slug, u.name, u.slug === slug); }).join("")
        + "</div>";
    }
    fill();
    fetchUsers().then(fill).catch(function () { /* the badge still reads a name */ });

    // Positioned against the button's rect each time it opens, because it is no
    // longer inside the badge and cannot inherit its place. Fixed, not absolute:
    // the page can scroll under it, and the one thing this must never do again
    // is get clipped by an ancestor.
    function place() {
      var r = btn.getBoundingClientRect();
      menu.style.position = "fixed";
      menu.style.left = Math.round(r.left) + "px";
      menu.style.top = Math.round(r.bottom + 6) + "px";
      // Nor off the right edge. On /map the badge sits in the top-right corner,
      // so a menu hung from its left edge ran off the side of a phone (Carter,
      // 2026-09-24, with a screenshot). Slide it left until it fits.
      var w = menu.offsetWidth;
      if (r.left + w > window.innerWidth - 8) {
        menu.style.left = Math.round(Math.max(8, window.innerWidth - 8 - w)) + "px";
      }
      // Then, if that would run off the bottom, lift it until it fits. Measured
      // after it is visible, or the height is 0 and this does nothing.
      var h = menu.offsetHeight;
      var room = window.innerHeight - 8;
      if (r.bottom + 6 + h > room) {
        // Above the badge if there is room up there, otherwise pinned to the
        // bottom of the screen — never off it.
        menu.style.top = Math.round(r.top - 6 - h >= 8 ? r.top - 6 - h : Math.max(8, room - h)) + "px";
      }
    }
    function open(on) {
      menu.hidden = !on;
      wrap.classList.toggle("open", on);
      btn.setAttribute("aria-expanded", on ? "true" : "false");
      if (!on) return;
      place();
      // Open onto whoever you are reading, centred, so a name a long way down
      // the list is not something you have to go hunting for.
      //
      // Measured from rects and applied as a DELTA. scrollTop by hand rather
      // than scrollIntoView(), which is entitled to scroll the page as well as
      // the box; and rects rather than offsetTop, which is measured from the
      // nearest positioned ancestor — that is .rbmenu, not the scroll box, so
      // it silently included the pinned Global above it and centred on the
      // wrong row.
      var box = menu.querySelector(".rbscroll");
      var cur = box && box.querySelector(".rbitem.on");
      if (!cur) return;
      var r = cur.getBoundingClientRect(), b = box.getBoundingClientRect();
      box.scrollTop += (r.top - b.top) - (b.height - r.height) / 2;
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      open(menu.hidden);
    });
    menu.addEventListener("click", function (e) {
      var b = e.target;
      while (b && b !== menu && !(b.className && String(b.className).indexOf("rbitem") >= 0)) {
        b = b.parentNode;
      }
      if (!b || b === menu) return;
      var v = b.getAttribute("data-v");
      // Same bookkeeping the old header picker did: the choice is remembered so
      // the rest of the nav follows you to the next page.
      try {
        if (v === "__all__") window.localStorage.removeItem("ch_rider");
        else window.localStorage.setItem("ch_rider", v);
      } catch (e2) {}
      window.location.href = v === "__all__" ? ("/" + page) : userPageHref(v, page);
    });
    document.addEventListener("click", function () { if (!menu.hidden) open(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) { open(false); btn.focus(); }
    });
    // A fixed menu does not travel with the page, so scrolling away from the
    // badge would leave it floating over the middle of the screen. Close it
    // instead of chasing the button. The scroll box inside it has
    // overscroll-behavior:contain, so scrolling the LIST does not reach here.
    window.addEventListener("scroll", function () { if (!menu.hidden) open(false); },
      { passive: true });
    window.addEventListener("resize", function () { if (!menu.hidden) place(); });
  }

  var RELOADS_ON_WRITE = { riders: 1, count: 1, map: 1, park: 1, coaster: 1, changes: 1, qc: 1, sitemap: 1,
                           manufacturer: 1, location: 1, coasters: 1, parks: 1 };
  function initNav(page) {
    if (typeof document === "undefined") return;
    applyTheme(readTheme());

    // A write in another tab (noteWrite, or /edit's copy of it) reloads a page
    // that only SHOWS data, so the map or the count you left open beside /edit
    // is showing the change when you look back at it. At once if it is the tab
    // you are looking at, otherwise the moment it is shown again. Never a page
    // you type into — /log, /add, /import, /rankings, /account and the profile
    // (its edit dialog) — where a reload would throw away what you were doing.
    if (RELOADS_ON_WRITE[page]) {
      var stale = false;
      window.addEventListener("storage", function (e) {
        if (e.key !== WROTE_KEY) return;
        if (document.visibilityState === "visible") location.reload(); else stale = true;
      });
      document.addEventListener("visibilitychange", function () {
        if (stale && document.visibilityState === "visible") location.reload();
      });
    }

    // Active rider persists between pages: the URL wins (/user/<slug>/...),
    // otherwise fall back to the last rider we remembered.
    //
    // Home is the exception. It shows everyone, so it clears the remembered
    // rider rather than displaying a name the page has nothing to do with. It
    // has to actually clear it, not just hide it: leaving it set would send the
    // next click on Coasters back to that rider while the picker said Everyone.
    var urlSlug = currentUser(), slug;
    try {
      if (page === "home") { window.localStorage.removeItem("ch_rider"); slug = ""; }
      else if (urlSlug) { window.localStorage.setItem("ch_rider", urlSlug); slug = urlSlug; }
      else { slug = window.localStorage.getItem("ch_rider") || ""; }
    } catch (e) { slug = (page === "home") ? "" : (urlSlug || ""); }

    // Every page except Home is per-rider. Keep this list complete: anything
    // missing from it loses the rider on navigation and, worse, sends the
    // picker to PER_RIDER's fallback instead of back to the page you're on.
    // querySelectorAll, not querySelector: Coasters is no longer in the header,
    // so its only links are the "Full credit list" ones in the Rides and Stats
    // heroes, and those need the rider too.
    // Profile is always YOUR profile when we know who you are — it is the way
    // back (Carter's call, 2026-09-16). Since 2026-09-25 Count and Rankings are
    // yours too once signed in (they used to follow whoever you were reading);
    // a visitor's still follow the page. myOwn is
    // filled in once /api/auth/me answers, and is null for a visitor — for whom
    // Profile keeps meaning the page they are on.
    var myOwn = null;
    function applyRiderLinks(forSlug) {
      for (var p = 0; p < PER_RIDER.length; p++) {
        var key = PER_RIDER[p];
        // Profile is YOURS, always: your page when we know who you are, the
        // sign-in page when we do not. Never the rider you happen to be reading
        // — signed out that made "Profile" a link to Cole, or on /riders a link
        // to the page you were already standing on.
        // Rankings and Credits open on YOUR list too (2026-09-25) — the
        // rider badge in their hero is how you look at someone else's, and
        // Rankings has a Mine | Global switch. Signed out, they follow the
        // page you are reading, as before.
        // ...but only in the header and the tab bar. A button on the page
        // itself — "View Sean's map" / "View Sean's count" on Sean's profile —
        // is about the rider you are reading, and pointing it home took you to
        // your own map every time (Carter, 2026-09-25).
        var els = document.querySelectorAll('[data-nav="' + key + '"]');
        for (var q = 0; q < els.length; q++) {
          var inNav = !!(els[q].closest && els[q].closest("nav.links, .tabbar"));
          var target = (key === "profile") ? myOwn : (inNav ? (myOwn || forSlug) : forSlug);
          els[q].setAttribute("href", userPageHref(target, key));
        }
      }
    }
    applyRiderLinks(slug);

    // Who you are arrives from /api/auth/me, after the links are already on
    // screen. Re-apply rather than patch one selector: the mobile tab bar is
    // built further down this function and has to be pointed home too, and a
    // later applyRiderLinks (the rider list landing) must not undo this.
    me().then(function (acct) {
      if (!acct || !acct.slug) return;
      myOwn = acct.slug;
      applyRiderLinks(slug);
    }).catch(function () { /* signed out, or the API is down: leave it alone */ });

    var links = document.querySelectorAll('nav.links a[data-nav]');
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle("active", links[i].getAttribute("data-nav") === page);
    }

    // No rider picker in the header any more (2026-09-17). Whose page this is
    // is now asked and answered by the hero badge, next to the headline it
    // changes. #people still exists on every page — it is the third column that
    // keeps the menu centred, and it holds the theme toggle and the account
    // avatar.
    var wrap = document.getElementById("people");
    // The links above are written from localStorage before the rider list has
    // arrived, because waiting would leave the nav dead on first paint. Once the
    // real list is here, a remembered rider who no longer exists (renamed away)
    // has been dropped by forgetUnknownRider — so re-apply, or the whole nav
    // would keep pointing at URLs that now 404 until the next page load.
    fetchUsers().then(function () {
      var now = slug;
      try {
        if (page !== "home" && !urlSlug) now = window.localStorage.getItem("ch_rider") || "";
      } catch (e) { /* storage blocked: keep what we started with */ }
      if (now !== slug) { slug = now; applyRiderLinks(slug); }
    });

    // Every page gets the same three-column header, even the ones with no rider
    // picker (Log, Import). The right-hand column has to EXIST for the menu to
    // stay centred — without it the menu inherits the slack and jumps sideways
    // as you navigate. So build an empty .people here rather than hanging the
    // toggle off .nav-inner as a fourth child.
    var themeHost = wrap;
    if (!themeHost) {
      var inner = document.querySelector("header.nav .nav-inner");
      if (inner) {
        themeHost = document.createElement("div");
        themeHost.className = "people";
        inner.appendChild(themeHost);
      }
    }
    accountCorner(themeHost);

    buildTabBar(page, slug);
    applyRiderLinks(slug);
    footerContrib();
  }

  // The two controls every header carries on its right: the theme toggle and
  // whoever is signed in. Split out of initNav so a page with its own header
  // and no site nav — /qc — can wear the same corner without inheriting
  // the rest of it (Carter, 2026-09-18).
  function accountCorner(host) {
    if (!host) return;
    if (!host.querySelector(".srchbtn")) buildSearchButton(host);
    if (!host.querySelector(".themetoggle")) buildThemeToggle(host, true);
    if (!host.querySelector(".acctlink")) buildAccountLink(host);
  }

  // The five pages, in one order, used by the header, this mobile tab bar and
  // the footer alike (Carter's call, 2026-09-16):
  //
  //   Riders · Rankings · Profile · Count · Log
  //
  // Riders is everyone, Profile is one person, and they sit either side of each
  // other on purpose: the middle slot is the easiest to hit with a thumb, and
  // your own page is what you reach for most. `fixed` = the same URL for
  // everyone, so Riders and Log take no /user/<slug>/ prefix the way the other
  // three do.
  //
  // Add new is still not here: adding a coaster to the shared list is
  // occasional and rarely done one-handed. Header on desktop, footer
  // everywhere, and a link on /log at the moment you find something missing.
  //
  // The words: "Count" is /count — the day log, every ride and the full credit
  // list in one place, where "Rides" named one of the three and read as a twin
  // of "Log". "Profile" is /user/<slug>, a rider's page rather than a chart
  // screen. "Riders" is /riders, which is where /stats used to point.
  // 2026-09-25, Carter: Home · Rankings · [+] · Credits · Profile. Logging a
  // ride is the reason to open the site, so it is the raised button in the
  // middle (`plus`). Home is the everyone hub; Rankings, Credits (/count) and
  // Profile are YOURS once we know who you are — see applyRiderLinks. The
  // desktop header lists the same five in the same order.
  var TABS = [
    { k: "riders",   label: "Home",     path: "/",         fixed: true },
    { k: "rankings", label: "Rankings", path: "/rankings" },
    { k: "log",      label: "Log",      path: "/log",      fixed: true, plus: true },
    { k: "count",    label: "Credits",  path: "/credits" },
    { k: "profile",  label: "Profile",  path: "/account" }
  ];
  // Five is the ceiling, and this is five: measured at 320px (the narrowest
  // phone) the widest label, "Rankings", fills 58 of its 64px slot. A sixth tab
  // would need shorter labels or icons only.
  // One per tab in TABS, no spares. `profile` is the odd one out: it is drawn
  // from the signed-in account's picture when there is one (see buildTabBar),
  // and this outline of a person is the same placeholder /riders uses.
  var TAB_ICONS = {
    riders:   '<path d="M4 10.5 12 4l8 6.5V20h-5v-6h-6v6H4z"/>',
    rankings: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/>',
    profile:  '<path d="M19 20v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7"/>',
    count:    '<path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4"/>',
    log:      '<path d="M12 5v14M5 12h14"/>'
  };
  function buildTabBar(page, slug) {
    if (typeof document === "undefined" || document.querySelector(".tabbar")) return;
    var nav = document.createElement("nav");
    nav.className = "tabbar";
    nav.setAttribute("aria-label", "Primary");
    nav.innerHTML = TABS.map(function (t) {
      var href = (t.fixed || !slug) ? t.path : userPageHref(slug, t.k);
      var cls = (t.plus ? "plus" : "") + (t.k === page ? " on" : "");
      var svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'
        + (t.plus ? "2.4" : "1.8") + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + TAB_ICONS[t.k] + '</svg>';
      return '<a href="' + href + '" data-nav="' + t.k + '"'
        + (cls.trim() ? ' class="' + cls.trim() + '"' : '')
        + (t.k === page ? ' aria-current="page"' : '') + '>'
        + (t.plus ? '<i class="plusdisc">' + svg + '</i>' : svg)
        + '<span>' + t.label + '</span></a>';
    }).join("");
    document.body.appendChild(nav);

    // Your own face on the Profile tab, the way every app you already use does
    // it. No picture, or signed out, and the outline of a person stays — the
    // same placeholder the riders list draws.
    me().then(function (acct) {
      if (!acct || !acct.avatar) return;
      var a = nav.querySelector('a[data-nav="profile"]');
      var svg = a && a.querySelector("svg");
      if (!svg) return;
      var pic = document.createElement("span");
      pic.className = "tabav";
      pic.style.backgroundImage = 'url("/avatars/' + acct.avatar + '")';
      svg.parentNode.replaceChild(pic, svg);
    }).catch(function () { /* signed out: the outline is right */ });
  }

  // The MODEL, not "manufacturer model" — most models already carry the maker's
  // name ("RMC Hybrid", "S&S 4D") and the pair read as a stutter: "Rocky
  // Mountain Construction RMC Hybrid". Carter's call, 2026-09-17.
  //
  // A coaster with a manufacturer and no model falls back to the manufacturer,
  // because there is no stutter to remove there and "Philadelphia Toboggan
  // Coasters" beats an empty space. Neither filled gives an empty string and no
  // separator anywhere.
  function maker(c) {
    if (!c) return "";
    var mo = String(c.model || "").trim();
    return mo || String(c.manu || "").trim();
  }

  // The line a hero wears while its numbers are still on the way. One pool for
  // the whole site, picked at random per page load, so it does not greet you
  // with the same word every time. Carter writes these in the copy desk; the
  // list lives here and nowhere else, so a new page only has to put
  // data-loading on its <h1> to join in.
  // The ellipsis belongs to the loading state, not to the phrase, so it is added
  // here rather than asked of whoever writes the list: a line in the copy desk
  // reads "Reriding" and the page shows "Reriding…".
  var LOADING = [
    "Credit whoring",
    "Reriding",
    "Getting in line",
    "Ropedropping",
    "Counting rides",
    "Tracking stats",
    "Loop-de-looping",
    // A true minus (U+2212), not a hyphen: at hero size a hyphen sits low and
    // short beside a numeral and reads as a dash rather than a sign.
    "Hitting \u22122",
    // The ellipses inside this one are Carter's; the mapper below only strips a
    // trailing one, so the internal beats survive and it still ends "1\u2026".
    "3\u2026 2\u2026 1"
  ].map(function (t) { return t.replace(/[.\u2026]+$/, "") + "\u2026"; });
  function loadingLine() { return LOADING[Math.floor(Math.random() * LOADING.length)]; }

  // Swapped in as app.js runs — before any page's own script and, because this
  // is a blocking <script> at the end of <body>, before the hero is painted.
  // Doing it on DOMContentLoaded would show the markup's line first and then
  // visibly change it.
  //
  // One shuffle per page load, dealt out in document order rather than a fresh
  // pick each time: a page with both a hero line and a smaller one below it
  // would otherwise sometimes print the same phrase twice, which reads as a bug
  // rather than as a joke.
  if (typeof document !== "undefined") {
    var _load = document.querySelectorAll("[data-loading]");
    if (_load.length) {
      var _bag = LOADING.slice();
      for (var _s = _bag.length - 1; _s > 0; _s--) {
        var _r = Math.floor(Math.random() * (_s + 1)), _t = _bag[_s];
        _bag[_s] = _bag[_r]; _bag[_r] = _t;
      }
      for (var _i = 0; _i < _load.length; _i++) _load[_i].textContent = _bag[_i % _bag.length];
    }
  }

  // ---- The database pages' shared parts (2026-09-25) ------------------------
  // Park, coaster, manufacturer, model and location pages each had their own
  // copy of these and drifted (Carter: "feel like it's getting messy"). One
  // copy each, here and in style.css (.crumbs, .tiles, .youline, .facts).

  // Breadcrumbs: [[label, href], ...], the last one the page you are on.
  function crumbs(el, trail) {
    if (!el) return;
    el.className = "crumbs";
    el.innerHTML = trail.filter(function (t) { return t && t[0]; }).map(function (t, i, all) {
      var last = i === all.length - 1;
      return last || !t[1] ? '<span>' + searchEsc(t[0]) + '</span>'
        : '<a href="' + searchEsc(t[1]) + '">' + searchEsc(t[0]) + '</a>';
    }).join('<i aria-hidden="true">\u203a</i>');
  }

  // Who you are, what you have ridden (id -> {n, first}) and where you rank
  // each coaster (id -> position), fetched once per page. null signed out.
  var youP = null;
  function you() {
    if (!youP) youP = me().then(function (a) {
      if (!a || !a.slug) return null;
      return Promise.all([
        fetchRides(a.slug).catch(function () { return { rides: [] }; }),
        fetch("/api/rankings/" + encodeURIComponent(a.slug), { cache: "no-store", credentials: "same-origin" })
          .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      ]).then(function (r) {
        var rides = {}, rank = {}, order = (r[1] && r[1].order) || [];
        (r[0].rides || []).forEach(function (x) {
          var m = rides[x.c] || (rides[x.c] = { n: 0, first: null });
          m.n++; if (x.d && (!m.first || x.d < m.first)) m.first = x.d;
        });
        order.forEach(function (id, i) { rank[id] = i + 1; });
        return { slug: a.slug, rides: rides, rank: rank, ranked: order.length };
      });
    }).catch(function () { return null; });
    return youP;
  }

  // The "you" line under a page's tiles: for a set of coasters, how many of
  // the operating ones you have ridden and your best ranked; for one coaster,
  // how many times, since when, and where it ranks. Nothing signed out.
  function youStrip(el, cs) {
    if (!el) return;
    you().then(function (y) {
      if (!y) { el.hidden = true; return; }
      var bits = [];
      if (cs.length === 1) {
        var c = cs[0], m = y.rides[c.id];
        bits.push(m ? "You have ridden it <b>" + (m.n > 1 ? m.n + " times" : "once") + "</b>"
                      + (m.first ? ", first on <b>" + mdy(m.first) + "</b>" : "")
                    : "You have not ridden it yet");
        if (y.rank[c.id]) bits.push("ranked <b>#" + y.rank[c.id] + "</b> of " + y.ranked);
      } else {
        // No "ridden X of Y operating" (Carter, 2026-09-25: "remove all that" —
        // parked in the handoff's Possible future updates). Your ranking only.
        var rk = cs.filter(function (c) { return y.rank[c.id]; })
          .map(function (c) { return y.rank[c.id]; }).sort(function (a, b) { return a - b; });
        if (rk.length) bits.push("You have ranked <b>" + rk.length + "</b> \u00b7 best <b>#" + rk[0] + "</b> of " + y.ranked);
      }
      if (!bits.length) { el.hidden = true; return; }
      el.className = "youline";
      el.innerHTML = bits.join(" \u00b7 ");
      el.hidden = false;
    });
  }

  // One coaster's facts as label / value rows — the park page's open row and
  // a ranking's tapped row. `extra` rows (the reader's own) go last.
  function coasterFacts(c, extra) {
    var t = [], E = searchEsc;
    function kv(v, label) { t.push('<div class="kv"><span>' + E(label) + '</span><b>' + v + '</b></div>'); }
    function when(v, prec) { return (prec === "day" && /^\d{4}-\d{2}-\d{2}/.test(String(v))) ? mdy(v) : String(v).slice(0, 4); }
    if (c.type) kv('<span class="pill ' + (c.type === "Wood" ? "wood" : "steel") + '">' + E(c.type) + '</span>', "Type");
    if (c.manu) kv('<a href="' + E(makerHref(c.manu)) + '">' + E(c.manu) + '</a>', "Manufacturer");
    if (c.model) kv(c.manu ? '<a href="' + E(makerHref(c.manu, c.model)) + '">' + E(c.model) + '</a>' : E(c.model), "Model");
    if (c.opened) kv(E(when(c.opened, c.openedPrec)), "Opened"); else if (c.yr) kv(E(c.yr), "Opened");
    if (c.closed) kv(E(when(c.closed, c.closedPrec)), "Closed");
    if (c.h != null) kv(Math.round(c.h), "Height (ft)");
    if (c.s != null) kv(Math.round(c.s), "Speed (mph)");
    if (c.l != null) kv(Math.round(c.l).toLocaleString(), "Length (ft)");
    if (c.inv != null) kv(E(c.inv), "Inversions");
    if (c.dur != null) { var d = Math.round(c.dur), mm = Math.floor(d / 60), r = d % 60; kv(mm ? (mm + ":" + (r < 10 ? "0" : "") + r) : (d + "s"), "Ride time"); }
    (extra || []).forEach(function (x) { kv(x[0], x[1]); });
    return t.length ? '<div class="facts">' + t.join("") + '</div>' : '<p class="facts none">No stats on file yet.</p>';
  }

  // Coaster rows that open in place (2026-09-25, Carter: every list should
  // behave like the park page's). Any element with data-cid="<coaster id>"
  // inside `root` — an <a class="crow"> or a table <tr> — toggles a .cx panel
  // right after it: the facts, your rides and rank, and "Coaster page →".
  // Other links in the row (a park, a maker) still go where they point, and a
  // modified click (new tab) still follows the coaster link.
  function openableCoasters(root) {
    if (!root || root._openable) return;
    root._openable = true;
    root.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      if (e.target.closest(".cx")) return;
      var row = e.target.closest("[data-cid]");
      if (!row || !root.contains(row)) return;
      var a = e.target.closest("a");
      if (a && a !== row && !a.hasAttribute("data-cname")) return;
      e.preventDefault();
      var nx = row.nextElementSibling;
      if (nx && nx.classList.contains("cx")) { nx.parentNode.removeChild(nx); row.classList.remove("open"); return; }
      row.classList.add("open");
      var id = Number(row.getAttribute("data-cid"));
      var box, inner;
      if (row.tagName === "TR") {
        box = document.createElement("tr");
        var td = document.createElement("td");
        td.colSpan = row.children.length;
        box.appendChild(td);
        // A wide table scrolls sideways on a phone, and a cell spanning it is
        // as wide as the table — the values sat off-screen to the right. The
        // panel is pinned to the visible width of whatever scrolls it.
        inner = document.createElement("div");
        inner.className = "cxin";
        var sc = row.closest(".dtable-wrap") || row.closest("table").parentNode;
        if (sc && sc.clientWidth) inner.style.width = Math.max(200, sc.clientWidth - 28) + "px";
        td.appendChild(inner);
      } else { box = inner = document.createElement("div"); }
      box.className = "cx";
      inner.innerHTML = '<p class="facts none">Loading&hellip;</p>';
      row.parentNode.insertBefore(box, row.nextSibling);
      Promise.all([fetchCoasters(), you()]).then(function (r) {
        var c = null, cs = (r[0] && r[0].coasters) || [], y = r[1], extra = [];
        for (var i = 0; i < cs.length; i++) if (cs[i].id === id) { c = cs[i]; break; }
        if (!c) { inner.innerHTML = '<p class="facts none">Not found.</p>'; return; }
        var m = y && y.rides[id];
        if (m) { if (m.first) extra.push([mdy(m.first), "First ridden"]); extra.push([m.n, "Your rides"]); }
        if (y && y.rank[id]) extra.push(["#" + y.rank[id] + " of " + y.ranked, "Your rank"]);
        inner.innerHTML = coasterFacts(c, extra)
          + '<a class="go" href="' + searchEsc(coasterHref(c)) + '">Coaster page &rarr;</a>';
      });
    });
  }

  // The footer's contributor links: Add new for anyone signed in (adding a
  // coaster is open to riders), Edit and QC for admins only. Everyone else's
  // footer is just the ways around the site.
  function footerContrib() {
    var el = document.querySelector("footer.site [data-contrib]");
    if (!el) return;
    me().then(function (a) {
      if (!a) return;
      var l = [['/add', 'Add new']];
      if (a.admin) l.push(['/edit', 'Edit'], ['/qc', 'QC']);
      el.innerHTML = l.map(function (x) { return ' &nbsp;&middot;&nbsp; <a href="' + x[0] + '">' + x[1] + '</a>'; }).join("");
      el.hidden = false;
    }).catch(function () {});
  }

  // ---- Search, from every page's header (2026-09-25) -----------------------
  // One box that finds coasters, parks, manufacturers, models, locations and
  // riders — the glue that lets the database side of the site go without a
  // tab of its own (Carter: "yes 1": Home is the hub, search is in the
  // header). Everything it searches is already fetched and cached by the
  // pages (coasters, parks, users), so it costs nothing until it is opened,
  // and then one pass over ~1,500 names per keystroke.
  //
  // Abbreviations work by initials: "B&M" and "bm" find Bolliger & Mabillard,
  // "RMC" Rocky Mountain Construction, "KD" Kings Dominion.
  var SEARCH_KINDS = { park: "Park", coaster: "Coaster", maker: "Manufacturer",
                       model: "Model", loc: "Location", rider: "Rider" };
  // Order among equally good matches: places before the rides in them.
  var SEARCH_RANK = { park: 0, maker: 1, loc: 2, model: 3, rider: 4, coaster: 5 };
  var searchIndex = null;
  function norm(t) {
    return String(t == null ? "" : t).toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/['\u2019]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function initials(n) {
    var w = n.split(" ").filter(function (x) { return x && !/^(the|of|and|de|du|la|le)$/.test(x); });
    return w.length > 1 ? w.map(function (x) { return x.charAt(0); }).join("") : "";
  }
  function buildSearchIndex() {
    if (searchIndex) return searchIndex;
    searchIndex = Promise.all([
      fetchCoasters().catch(function () { return { coasters: [] }; }),
      fetchParks().catch(function () { return {}; }),
      fetchUsers().catch(function () { return USERS; })
    ]).then(function (res) {
      var cs = (res[0] && res[0].coasters) || [], parks = res[1] || {}, users = res[2] || [];
      var out = [], add = function (k, t, sub, href, extra) {
        var n = norm(t);
        out.push({ k: k, t: t, sub: sub, h: href, n: n, ini: initials(n), gone: !!(extra && extra.gone) });
      };
      var makers = {}, models = {}, locs = {}, pn = {};
      cs.forEach(function (c) {
        if (c.park) pn[c.park] = (pn[c.park] || 0) + 1;
        var m = String(c.manu || "").trim(), mo = String(c.model || "").trim();
        if (m) makers[m] = (makers[m] || 0) + 1;
        if (m && mo) { var key = m + "\u0000" + mo; (models[key] = models[key] || { m: m, mo: mo, n: 0 }).n++; }
        add("coaster", c.name, c.park || "", coasterHref(c), { gone: !!c.closed });
      });
      Object.keys(parks).forEach(function (p) {
        var r = (parks[p] && parks[p].region) || "";
        if (r) locs[r] = (locs[r] || 0) + 1;
        add("park", p, r || ((pn[p] || 0) + " coasters"), parkHref(p));
      });
      Object.keys(makers).forEach(function (m) { add("maker", m, makers[m] + " coaster" + (makers[m] === 1 ? "" : "s"), makerHref(m)); });
      Object.keys(models).forEach(function (k) { var x = models[k]; add("model", x.mo, x.m + " \u00b7 " + x.n, makerHref(x.m, x.mo)); });
      Object.keys(locs).forEach(function (r) { add("loc", r, locs[r] + " park" + (locs[r] === 1 ? "" : "s"), locationHref(r)); });
      users.forEach(function (u) { if (u && u.slug) add("rider", u.name || u.slug, "@" + u.slug, userPageHref(u.slug, "profile")); });
      return out;
    });
    return searchIndex;
  }
  function searchFor(items, q) {
    var nq = norm(q), cq = nq.replace(/ /g, "");
    if (!nq) return [];
    var hits = [];
    items.forEach(function (it) {
      var sc = -1, i = it.n.indexOf(nq);
      if (it.n === nq) sc = 0;
      else if (i === 0) sc = 1;
      else if (i > 0 && it.n.charAt(i - 1) === " ") sc = 2;
      // An abbreviation almost always means a maker ("B&M", "RMC"), so a maker's
      // initials outrank a park that happens to share them (Bosque Mágico).
      else if (cq.length >= 2 && it.ini && it.ini === cq) sc = it.k === "maker" ? 0.5 : 1.5;
      else if (cq.length >= 2 && it.ini && it.ini.indexOf(cq) === 0) sc = 3;
      else if (i > 0 && nq.length >= 3) sc = 4;
      if (sc >= 0) hits.push({ it: it, sc: sc });
    });
    hits.sort(function (a, b) {
      return a.sc - b.sc || SEARCH_RANK[a.it.k] - SEARCH_RANK[b.it.k]
        || (a.it.gone ? 1 : 0) - (b.it.gone ? 1 : 0) || a.it.t.length - b.it.t.length
        || a.it.t.localeCompare(b.it.t);
    });
    return hits.slice(0, 40).map(function (h) { return h.it; });
  }
  var searchEl = null;
  function searchEsc(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function openSearch(seed) {
    if (typeof document === "undefined") return;
    if (!searchEl) {
      searchEl = document.createElement("div");
      searchEl.className = "srch";
      searchEl.hidden = true;
      searchEl.innerHTML = '<div class="srchbox" role="dialog" aria-label="Search">'
        + '<div class="srchbar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" '
        + 'stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
        + '<input type="search" placeholder="Coasters, parks, manufacturers, places, riders&hellip;" '
        + 'autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Search">'
        + '<button type="button" class="srchx">Close</button></div>'
        + '<div class="srchres" role="listbox"></div></div>';
      document.body.appendChild(searchEl);
      var input = searchEl.querySelector("input"), res = searchEl.querySelector(".srchres");
      var draw = function () {
        buildSearchIndex().then(function (items) {
          var q = input.value, hits = searchFor(items, q);
          res.innerHTML = !norm(q)
            ? '<p class="srchhint">Try a coaster, a park, a maker like <b>B&amp;M</b>, a state, or a rider.</p>'
            : hits.length
              ? hits.map(function (h, i) {
                  return '<a class="srchrow' + (i === 0 ? " hi" : "") + (h.gone ? " gone" : "") + '" href="' + searchEsc(h.h) + '">'
                    + '<span class="st"><b>' + searchEsc(h.t) + '</b><span>' + searchEsc(h.sub) + '</span></span>'
                    + '<span class="sk">' + SEARCH_KINDS[h.k] + '</span></a>';
                }).join("")
              : '<p class="srchhint">Nothing called that.</p>';
        });
      };
      input.addEventListener("input", draw);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { var a = res.querySelector(".srchrow"); if (a) location.href = a.getAttribute("href"); }
        else if (e.key === "Escape") closeSearch();
      });
      searchEl.querySelector(".srchx").addEventListener("click", closeSearch);
      searchEl.addEventListener("click", function (e) { if (e.target === searchEl) closeSearch(); });
      searchEl._draw = draw;
    }
    var inp = searchEl.querySelector("input");
    if (seed != null) inp.value = seed;
    searchEl.hidden = false;
    document.documentElement.classList.add("srchopen");
    inp.focus();
    searchEl._draw();
  }
  function closeSearch() {
    if (!searchEl) return;
    searchEl.hidden = true;
    document.documentElement.classList.remove("srchopen");
  }
  function buildSearchButton(host) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "srchbtn";
    b.setAttribute("aria-label", "Search");
    b.title = "Search";
    b.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" '
      + 'stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
    b.addEventListener("click", function () { openSearch(); });
    host.insertBefore(b, host.firstChild);
  }
  // "/" opens it from anywhere on a keyboard, the way most sites do.
  if (typeof document !== "undefined") document.addEventListener("keydown", function (e) {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    e.preventDefault(); openSearch();
  });

  var api = { computeStats: computeStats, maker: maker, loadingLine: loadingLine, loadUser: loadUser, currentUser: currentUser, me: me,
              USERS: USERS, initNav: initNav, userPageHref: userPageHref,
              slugify: slugify, parkHref: parkHref, makerHref: makerHref, locationHref: locationHref, mdy: mdy, coasterHref: coasterHref,
              findPark: findPark, findCoaster: findCoaster, formerNames: formerNames,
              fetchCoasters: fetchCoasters, fetchParks: fetchParks, fetchUser: fetchUser,
              fetchRides: fetchRides, fetchUsers: fetchUsers, fetchSummary: fetchSummary, fetchAllRides: fetchAllRides, mergeUsers: mergeUsers, noteWrite: noteWrite,
              adoptUsers: adoptUsers, riderBadge: riderBadge, accountCorner: accountCorner,
              openSearch: openSearch, searchIndex: buildSearchIndex, searchFor: searchFor,
              crumbs: crumbs, you: you, youStrip: youStrip, coasterFacts: coasterFacts,
              openableCoasters: openableCoasters };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.CoasterHub = api;
})(typeof window !== "undefined" ? window : globalThis);
