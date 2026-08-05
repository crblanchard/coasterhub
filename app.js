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

  // Ride log for one rider: { user, mode, rides:[{i?, c, d, num?, n?}] }.
  // The API returns that shape directly; the static fallback file is the older
  // per-rider shape, so normalise it here and both paths render identically.
  function fetchRides(slug) {
    return fetch("/api/rides/" + slug)
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
      stats.parks = parks;
      stats.rides = user.rides || [];
      return stats;
    });
  }

  // ---- Multi-user site config + shared nav --------------------------------
  var USERS = [
    { slug: "carter", name: "Carter" },
    { slug: "cole",   name: "Cole"   },
    { slug: "keltan", name: "Keltan" },
    { slug: "max",    name: "Max"    },
    { slug: "sean",   name: "Sean"   }
  ];
  var DEFAULT_SLUG = "carter";

  // URL for a given person's page. The default user lives at the site root
  // (/stats, /coasters); everyone else lives under /user/<slug>/.
  function userPageHref(slug, page) {
    if (page === "home") return "/";
    return "/user/" + slug + "/" + page;   // a rider's own stats or coasters
  }

  // The pages that exist per rider, i.e. everything but Home. Used for both
  // the header links and the rider picker so the two can't disagree.
  // Pages that belong to one rider and take a /user/<slug>/ prefix. Add new is
  // deliberately absent: it edits the shared database, so it reads the same
  // whoever is looking at it.
  var PER_RIDER = ["rides", "stats", "rankings"];

  // Wire the header for a page ("home" | "stats" | "coasters" | "rides" |
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
    for (var p = 0; p < PER_RIDER.length; p++) {
      var els = document.querySelectorAll('[data-nav="' + PER_RIDER[p] + '"]');
      for (var q = 0; q < els.length; q++) {
        els[q].setAttribute("href", slug ? "/user/" + slug + "/" + PER_RIDER[p] : "/" + PER_RIDER[p]);
      }
    }

    var links = document.querySelectorAll('nav.links a[data-nav]');
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle("active", links[i].getAttribute("data-nav") === page);
    }

    var wrap = document.getElementById("people");
    if (wrap) {
      var sorted = USERS.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
      // "Everyone" reads clearer than "All" to someone landing here for the
      // first time — it's a person picker, not a filter.
      var opts = '<option value="__all__"' + (slug ? "" : " selected") + '>Everyone</option>';
      opts += sorted.map(function (u) {
        return '<option value="' + u.slug + '"' + (u.slug === slug ? " selected" : "") + '>' + u.name + '</option>';
      }).join("");
      wrap.innerHTML = '<select class="userpick" aria-label="Select rider">' + opts + '</select>';
      var sel = wrap.querySelector("select");
      // Switching riders keeps you on the page you're already reading. Home is
      // the only page with no per-rider version, so it stays put.
      var perRider = PER_RIDER.indexOf(page) >= 0;
      sel.addEventListener("change", function () {
        var v = sel.value;
        try {
          if (v === "__all__") window.localStorage.removeItem("ch_rider");
          else window.localStorage.setItem("ch_rider", v);
        } catch (e) {}
        if (v === "__all__") location.href = perRider ? ("/" + page) : "/";
        else location.href = perRider ? ("/user/" + v + "/" + page) : ("/user/" + v + "/stats");
      });
      // Label the control, and let the dropdown carry the value — "Viewing"
      // beside a picker reading "Max" says it once. On a phone the page hero
      // scrolls away, so this keeps "who am I looking at?" answered on screen.
      var who = document.createElement("span");
      who.className = "whoami";
      who.textContent = "Viewing";
      wrap.insertBefore(who, wrap.firstChild);
    }

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

    buildTabBar(page, slug);
  }

  // Mobile tab bar. Built here rather than in markup so all four pages get it
  // (and the same ordering) from one place. Hidden above 680px by the CSS.
  // `fixed` = the same URL for everyone. Home shows all riders, and the log
  // picks its rider from a dropdown rather than the path, so neither takes the
  // /user/<slug>/ prefix the other tabs get.
  //
  // The last slot is Log, not Add new: logging is the thing a rider does
  // repeatedly and on a phone at a park, whereas adding a park or coaster to
  // the shared database is occasional and rarely done one-handed. Add new
  // stays in the desktop header and the footer, so it is still reachable on a
  // phone — just not holding a thumb-sized slot it does not earn.
  var TABS = [
    { k: "home",     label: "Home",     path: "/",         fixed: true },
    { k: "rankings", label: "Rankings", path: "/rankings" },
    { k: "stats",    label: "Stats",    path: "/stats" },
    { k: "rides",    label: "Rides",    path: "/rides" },
    { k: "log",      label: "Log",      path: "/log",      fixed: true }
  ];
  // Five is the ceiling: measured at 320px (the narrowest phone) the widest
  // label, "Rankings", fills 58 of its 64px slot. A sixth tab would need
  // shorter labels or icons only.
  var TAB_ICONS = {
    home:     '<path d="M3 10.2 12 3l9 7.2V21H3z"/>',
    coasters: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    rides:    '<path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4"/>',
    stats:    '<path d="M5 20v-6M12 20V6M19 20v-9"/>',
    rankings: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/>',
    log:      '<path d="M12 5v14M5 12h14"/>'
  };
  function buildTabBar(page, slug) {
    if (typeof document === "undefined" || document.querySelector(".tabbar")) return;
    var nav = document.createElement("nav");
    nav.className = "tabbar";
    nav.setAttribute("aria-label", "Primary");
    nav.innerHTML = TABS.map(function (t) {
      var href = t.fixed ? t.path : (slug ? "/user/" + slug + "/" + t.k : t.path);
      return '<a href="' + href + '"' + (t.k === page ? ' class="on" aria-current="page"' : '') + '>'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + TAB_ICONS[t.k] + '</svg>'
        + '<span>' + t.label + '</span></a>';
    }).join("");
    document.body.appendChild(nav);
  }

  var api = { computeStats: computeStats, loadUser: loadUser, currentUser: currentUser,
              USERS: USERS, initNav: initNav, userPageHref: userPageHref,
              fetchCoasters: fetchCoasters, fetchParks: fetchParks, fetchUser: fetchUser,
              fetchRides: fetchRides };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.CoasterHub = api;
})(typeof window !== "undefined" ? window : globalThis);
