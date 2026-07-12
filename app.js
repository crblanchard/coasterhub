/* Coaster Hub — shared data engine.
   Loads normalized JSON (coasters + parks + a user's data) and computes
   every stat the site shows. Pure computeStats() is Node-testable.

   A user file can carry different levels of detail. The engine detects three
   INDEPENDENT capabilities and flags each, so the UI shows only what the data
   supports (people's dashboards look the same — richer data just adds panels):
     • firstDates  — a date per credit  -> timeline (cumulative + new-per-year)
     • rideCounts  — a ride count per credit -> total rides, most-ridden, re-ride distance
     • activity    — a full dated ride log -> calendar heatmap, rides-per-year, biggest days
     • order       — a credit number per credit -> milestone credits (1st, 100th, 200th, ...)

   Accepted shapes (any mix of the optional fields works):
     {user, credits:["id", ...]}                              // collection only
     {user, credits:[{c:"id", n:12}, ...]}                    // + ride counts
     {user, credits:[{c:"id", first:"YYYY-MM-DD"}, ...]}      // + first-ridden dates
     {user, credits:[{c:"id", first:"2019", n:12}, ...]}      // + both (year ok)
     {user, credits:[{c:"id", num:200}, ...]}                 // + credit numbers (milestones)
     {user, rides:[{c:"id", d:"YYYY-MM-DD"}, ...]}            // full log (all of the above)
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
    var creditNum = {};      // id -> the rider's credit number for that coaster (order)
    var hasFullLog = false, hasCounts = false;

    var ridesInput = null, creditsInput = null;
    if (Array.isArray(userInput)) ridesInput = userInput;
    else if (userInput && userInput.rides) ridesInput = userInput.rides;
    else if (userInput && userInput.credits) creditsInput = userInput.credits;
    else ridesInput = [];

    if (ridesInput) {
      ridesInput.forEach(function (r) {
        if (!(r.c in byId)) return;
        creditSet[r.c] = true;
        creditCount[r.c] = (creditCount[r.c] || 0) + 1;
        if (r.d) {
          log.push({ c: r.c, d: r.d });
          if (!firstRidden[r.c] || r.d < firstRidden[r.c]) firstRidden[r.c] = r.d;
        }
      });
      hasCounts = ridesInput.length > 0;
      hasFullLog = log.length > 0;
    } else {
      creditsInput.forEach(function (item) {
        var id = (item && typeof item === "object") ? item.c : item;
        if (!(id in byId)) return;
        creditSet[id] = true;
        if (item && typeof item === "object") {
          if (item.n != null) { creditCount[id] = (creditCount[id] || 0) + item.n; hasCounts = true; }
          if (item.first) { var f = String(item.first); if (!firstRidden[id] || f < firstRidden[id]) firstRidden[id] = f; }
          if (item.num != null) { creditNum[id] = item.num; }
        }
      });
    }
    var hasFirstDates = Object.keys(firstRidden).length > 0;
    var hasOrder = Object.keys(creditNum).length > 0;

    // ---- Milestone credits (need a credit number per credit; no dates required) ---
    // Sort credits by their number; surface the 1st, every 100th, and the latest.
    var milestones = [];
    if (hasOrder) {
      var orderedNums = Object.keys(creditNum)
        .map(function (id) { return { id: +id, num: creditNum[id] }; })
        .sort(function (a, b) { return a.num - b.num; });
      var maxN = orderedNums[orderedNums.length - 1].num, picks = {};
      picks[1] = true;
      for (var mm = 100; mm <= maxN; mm += 100) picks[mm] = true;
      picks[maxN] = true;
      Object.keys(picks).map(Number).sort(function (a, b) { return a - b; }).forEach(function (t) {
        // the coaster reached at credit number t (exact, else the highest number below t)
        var chosen = null;
        for (var i = 0; i < orderedNums.length; i++) {
          if (orderedNums[i].num > t) break;
          chosen = orderedNums[i];
        }
        if (!chosen) return;
        var c = byId[chosen.id]; if (!c) return;
        milestones.push({ n: t, name: c.name, park: c.park });
      });
    }

    var creditList = Object.keys(creditSet).map(function (id) { return byId[id]; });

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
      if (c.loc) loc[c.loc] = (loc[c.loc] || 0) + 1;
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
      // parks still count via each coaster's `loc`, they just aren't mapped.
      var g = parks[pk]; if (!g || g.lat == null || g.lon == null) return;
      parksGeo.push({ park: pk, lat: g.lat, lon: g.lon, region: g.region,
        rides: parkRides[pk] || 0, credits: parkCredits[pk] });
    });
    parksGeo.sort(function (a, b) { return (b.rides || b.credits) - (a.rides || a.credits); });

    // Region comes from the coaster's park — one value per park, so coasters at
    // the same park are always counted the same way even when their individual
    // loc fields disagree (loc is free text from mixed imports). Fall back to the
    // coaster's own loc when the park isn't in parks.json (e.g. a friend's new
    // park that hasn't been geocoded yet).
    var states = new Set(), countries = new Set();
    creditList.forEach(function (c) {
      var pg = parks[c.park];
      var reg = (pg && pg.region) || c.loc; if (!reg) return;
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
        rideCounts: hasCounts,
        order: hasOrder
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
      milestones: milestones,
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
            last: dates[dates.length - 1] || null, dates: dates,
            num: creditNum[id] != null ? creditNum[id] : null
          };
        });
        return m;
      })(),
      coastersById: byId
    };
  }

  // Active user from a pretty path (/user/<name>/stats) or ?user=<name>. Null = Carter.
  function currentUser() {
    if (typeof location === "undefined") return null;
    var m = location.pathname.match(/\/user\/([^\/]+)/);
    if (m) return decodeURIComponent(m[1]);
    return new URLSearchParams(location.search).get("user");
  }

  // Data loading: prefer the D1-backed API, fall back to the static JSON files
  // (kept in the repo as the seed + a safety net) if the API is unavailable.
  function fetchJSON(apiPath, staticPath) {
    return fetch(apiPath).then(function (r) { if (!r.ok) throw new Error("api " + r.status); return r.json(); })
      .catch(function () { return fetch(staticPath).then(function (r) { return r.json(); }); });
  }
  function fetchCoasters() { return fetchJSON("/api/coasters", "/coasters.json"); }
  function fetchParks() { return fetchJSON("/api/parks", "/parks.json"); }
  function fetchUser(slug) { return fetchJSON("/api/user/" + slug, "/" + slug + ".json"); }

  function loadUser(userFile) {
    if (!userFile) { var u = currentUser(); userFile = u ? u + ".json" : "carter.json"; }
    var slug = userFile.replace(/\.json$/, "");
    return Promise.all([
      fetchCoasters(),
      fetchParks(),
      fetchUser(slug)
    ]).then(function (res) {
      var coasters = res[0].coasters, parks = res[1], user = res[2];
      var stats = computeStats(coasters, parks, user);
      stats.userName = user.user;
      stats.coasters = coasters;
      stats.rides = user.rides || [];
      return stats;
    });
  }

  // ---- Multi-user site config + shared nav --------------------------------
  var USERS = [
    { slug: "carter", name: "Carter" },
    { slug: "cole",   name: "Cole"   },
    { slug: "keltan", name: "Keltan" },
    { slug: "max",    name: "Max"    }
  ];
  var DEFAULT_SLUG = "carter";

  // URL for a given person's page. The default user lives at the site root
  // (/stats, /coasters); everyone else lives under /user/<slug>/.
  function userPageHref(slug, page) {
    if (page === "home") return "/";
    return "/user/" + slug + "/" + page;   // a rider's own stats or coasters
  }

  // Wire the header for a page ("home" | "stats" | "coasters"): point the
  // Stats/Coasters links at the current person, mark the active link, and
  // render the User picker (alphabetical).
  function initNav(page) {
    if (typeof document === "undefined") return;

    // Active rider persists between pages: the URL wins (/user/<slug>/...),
    // otherwise fall back to the last rider we remembered (so it carries to Home).
    var urlSlug = currentUser(), slug;
    try {
      if (urlSlug) { window.localStorage.setItem("ch_rider", urlSlug); slug = urlSlug; }
      else { slug = window.localStorage.getItem("ch_rider") || ""; }
    } catch (e) { slug = urlSlug || ""; }

    var sEl = document.querySelector('[data-nav="stats"]');
    var cEl = document.querySelector('[data-nav="coasters"]');
    if (sEl) sEl.setAttribute("href", slug ? "/user/" + slug + "/stats" : "/stats");
    if (cEl) cEl.setAttribute("href", slug ? "/user/" + slug + "/coasters" : "/coasters");

    var links = document.querySelectorAll('nav.links a[data-nav]');
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle("active", links[i].getAttribute("data-nav") === page);
    }

    var wrap = document.getElementById("people");
    if (wrap) {
      var sorted = USERS.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
      var opts = '<option value="__all__"' + (slug ? "" : " selected") + '>All</option>';
      opts += sorted.map(function (u) {
        return '<option value="' + u.slug + '"' + (u.slug === slug ? " selected" : "") + '>' + u.name + '</option>';
      }).join("");
      wrap.innerHTML = '<select class="userpick" aria-label="Select rider">' + opts + '</select>';
      var sel = wrap.querySelector("select");
      var kind = (page === "coasters") ? "coasters" : "stats"; // keep the same page type when switching
      sel.addEventListener("change", function () {
        var v = sel.value;
        try {
          if (v === "__all__") window.localStorage.removeItem("ch_rider");
          else window.localStorage.setItem("ch_rider", v);
        } catch (e) {}
        if (v === "__all__") location.href = (page === "coasters") ? "/coasters" : (page === "home" ? "/" : "/stats");
        else location.href = "/user/" + v + "/" + kind;
      });
    }
  }

  var api = { computeStats: computeStats, loadUser: loadUser, currentUser: currentUser,
              USERS: USERS, initNav: initNav, userPageHref: userPageHref,
              fetchCoasters: fetchCoasters, fetchParks: fetchParks, fetchUser: fetchUser };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.CoasterHub = api;
})(typeof window !== "undefined" ? window : globalThis);
