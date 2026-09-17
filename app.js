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
  function fetchCoasters() { return fetchJSON("/api/coasters", "/coasters.json"); }
  function fetchParks() { return fetchJSON("/api/parks", "/parks.json"); }
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
    { slug: "crblanchard", name: "Carter" },
    { slug: "cole",   name: "Cole"   },
    { slug: "keltan", name: "Keltan" },
    { slug: "max",    name: "Max"    },
    { slug: "sean",   name: "Sean"   }
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
    if (!slug) return page === "profile" ? "/account" : "/" + page;
    return page === "profile" ? "/user/" + slug : "/user/" + slug + "/" + page;
  }

  // The pages that exist per rider, i.e. everything but Home. Used for both
  // the header links and the rider picker so the two can't disagree.
  // Pages that belong to one rider and take a /user/<slug>/ prefix. Add new is
  // deliberately absent: it edits the shared database, so it reads the same
  // whoever is looking at it.
  var PER_RIDER = ["count", "profile", "rankings"];

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
    m.setAttribute("content", t === "light" ? "#f5f7fb" : "#0b1020");

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
  var GLOBAL_PAGES = { count: 1, rankings: 1 };

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

  function initNav(page) {
    if (typeof document === "undefined") return;
    applyTheme(readTheme());

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
    // back (Carter's call, 2026-09-16). Count and Rankings follow whoever you
    // are reading, so that looking at Sean's count and tapping Rankings gets you
    // Sean's; Profile is the one that breaks out of that, and landing on your
    // own page re-remembers you, so the other two come back with you. myOwn is
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
        var target = (key === "profile") ? myOwn : forSlug;
        var els = document.querySelectorAll('[data-nav="' + key + '"]');
        for (var q = 0; q < els.length; q++) {
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
    if (themeHost && !themeHost.querySelector(".themetoggle")) buildThemeToggle(themeHost, true);
    if (themeHost && !themeHost.querySelector(".acctlink")) buildAccountLink(themeHost);

    buildTabBar(page, slug);
    applyRiderLinks(slug);
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
  var TABS = [
    { k: "riders",   label: "Home",     path: "/",         fixed: true },
    { k: "rankings", label: "Rankings", path: "/rankings" },
    { k: "profile",  label: "Profile",  path: "/account" },
    { k: "count",    label: "Count",    path: "/count" },
    { k: "log",      label: "Log",      path: "/log",      fixed: true }
  ];
  // Five is the ceiling, and this is five: measured at 320px (the narrowest
  // phone) the widest label, "Rankings", fills 58 of its 64px slot. A sixth tab
  // would need shorter labels or icons only.
  // One per tab in TABS, no spares. `profile` is the odd one out: it is drawn
  // from the signed-in account's picture when there is one (see buildTabBar),
  // and this outline of a person is the same placeholder /riders uses.
  var TAB_ICONS = {
    riders:   '<path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.3a3.5 3.5 0 0 1 0 6.4"/>',
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
      return '<a href="' + href + '" data-nav="' + t.k + '"'
        + (t.k === page ? ' class="on" aria-current="page"' : '') + '>'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + TAB_ICONS[t.k] + '</svg>'
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

  var api = { computeStats: computeStats, loadUser: loadUser, currentUser: currentUser, me: me,
              USERS: USERS, initNav: initNav, userPageHref: userPageHref,
              fetchCoasters: fetchCoasters, fetchParks: fetchParks, fetchUser: fetchUser,
              fetchRides: fetchRides, fetchUsers: fetchUsers, mergeUsers: mergeUsers,
              adoptUsers: adoptUsers, riderBadge: riderBadge };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.CoasterHub = api;
})(typeof window !== "undefined" ? window : globalThis);
