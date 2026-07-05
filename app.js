/* Coaster Hub — shared data engine.
   Loads normalized JSON (coasters + parks + a user's ride log) and computes
   every stat the site shows. Pure computeStats() is Node-testable. */
(function (global) {
  "use strict";

  var US_STATES = new Set(["Colorado","Connecticut","Florida","Illinois","Indiana","Iowa",
    "Kentucky","Maryland","Massachusetts","Michigan","Minnesota","Missouri","Nevada",
    "New Jersey","New York","Ohio","Pennsylvania","Texas","Utah","Virginia","Washington",
    "Wisconsin","NorCal","SoCal"]);

  function regionKind(reg) {
    if (reg === "NorCal" || reg === "SoCal") return ["state", "California"];
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

  // coasters: [{id,name,park,loc,type,manu,model,h,s,l,inv,dur,laps,yr,closed}]
  // parks: {name:{lat,lon,region}}
  // rides: [{c:coasterId, d:'YYYY-MM-DD'}]
  function computeStats(coasters, parks, rides) {
    var byId = {};
    coasters.forEach(function (c) { byId[c.id] = c; });

    var creditIds = {}, ridesByYear = {}, newByYear = {}, dayCount = {}, dayParks = {},
        parkRides = {}, coasterRides = {}, firstRidden = {}, parkVisitDays = {}, visitSet = {};
    var years = new Set();
    var distFt = 0, invExp = 0, rideSec = 0;  // totals across every ride, counting re-rides and laps

    rides.forEach(function (r) {
      var c = byId[r.c]; if (!c) return;
      var yr = parseInt(r.d.slice(0, 4), 10);
      years.add(yr);
      creditIds[r.c] = true;
      distFt += (c.l || 0) * (c.laps || 1);
      invExp += (c.inv || 0) * (c.laps || 1);
      rideSec += (c.dur || 0);
      ridesByYear[yr] = (ridesByYear[yr] || 0) + 1;
      dayCount[r.d] = (dayCount[r.d] || 0) + 1;
      (dayParks[r.d] = dayParks[r.d] || {})[c.park] = (dayParks[r.d][c.park] || 0) + 1;
      parkRides[c.park] = (parkRides[c.park] || 0) + 1;
      coasterRides[r.c] = (coasterRides[r.c] || 0) + 1;
      if (!firstRidden[r.c] || r.d < firstRidden[r.c]) firstRidden[r.c] = r.d;
      var vkey = c.park + "|" + r.d;
      if (!visitSet[vkey]) { visitSet[vkey] = true; parkVisitDays[c.park] = (parkVisitDays[c.park] || 0) + 1; }
    });

    var creditList = Object.keys(creditIds).map(function (id) { return byId[id]; });
    Object.keys(firstRidden).forEach(function (id) {
      var y = parseInt(firstRidden[id].slice(0, 4), 10);
      newByYear[y] = (newByYear[y] || 0) + 1;
    });

    var yrMin = Math.min.apply(null, [...years]), yrMax = Math.max.apply(null, [...years]);
    var yearList = [];
    for (var y = yrMin; y <= yrMax; y++) yearList.push(y);
    var run = 0, cumulative = yearList.map(function (y) { run += (newByYear[y] || 0); return run; });

    var steel = 0, wood = 0, manu = {}, loc = {}, uniqueFt = 0, invUnique = 0;
    creditList.forEach(function (c) {
      if (c.type === "Wood") wood++; else steel++;
      if (c.manu) manu[c.manu] = (manu[c.manu] || 0) + 1;
      if (c.loc) loc[c.loc] = (loc[c.loc] || 0) + 1;
      uniqueFt += (c.l || 0); invUnique += (c.inv || 0);
    });

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
    var mostRiddenId = Object.keys(coasterRides).sort(function (a, b) { return coasterRides[b] - coasterRides[a]; })[0];
    var mostVisitedPark = Object.keys(parkVisitDays).sort(function (a, b) { return parkVisitDays[b] - parkVisitDays[a]; })[0];

    var dayDetail = {};
    Object.keys(dayCount).forEach(function (d) {
      dayDetail[d] = { t: dayCount[d],
        p: Object.keys(dayParks[d]).map(function (pk) { return [pk, dayParks[d][pk]]; })
              .sort(function (a, b) { return b[1] - a[1]; }) };
    });

    var parkCredits = {};
    creditList.forEach(function (c) { parkCredits[c.park] = (parkCredits[c.park] || 0) + 1; });
    var parksGeo = [];
    Object.keys(parkRides).forEach(function (pk) {
      var g = parks[pk]; if (!g) return;
      parksGeo.push({ park: pk, lat: g.lat, lon: g.lon, region: g.region,
        rides: parkRides[pk], credits: parkCredits[pk] || 0 });
    });
    parksGeo.sort(function (a, b) { return b.rides - a.rides; });

    var states = new Set(), countries = new Set();
    creditList.forEach(function (c) {
      var g = parks[c.park]; if (!g) return;
      var kv = regionKind(g.region);
      if (kv[0] === "state") states.add(kv[1]); else countries.add(kv[1]);
    });
    var nCountries = countries.size + (states.size ? 1 : 0);

    return {
      kpi: {
        credits: creditList.length, rides: rides.length,
        visits: Object.keys(visitSet).length,
        steel: steel, wood: wood, year_min: yrMin, year_max: yrMax, span: yrMax - yrMin + 1,
        parks: parksGeo.length, states: states.size, countries: nCountries,
        miles: Math.round(distFt / 5280), miles_unique: Math.round(uniqueFt / 5280),
        inversions: invExp, inversions_unique: invUnique,
        ride_hours: Math.round(rideSec / 3600)
      },
      years: yearList,
      rides_per_year: yearList.map(function (y) { return ridesByYear[y] || 0; }),
      new_credits_per_year: yearList.map(function (y) { return newByYear[y] || 0; }),
      cumulative_credits: cumulative,
      biggest_days: biggest,
      top_parks: topN(parkRides, 12, "park", "rides"),
      top_manufacturers: topN(manu, 10, "name", "credits"),
      top_locations: topN(loc, 12, "loc", "credits"),
      records: {
        tallest: tallest && { name: tallest.name, val: tallest.h, unit: "ft" },
        fastest: fastest && { name: fastest.name, val: fastest.s, unit: "mph" },
        longest: longest && { name: longest.name, val: longest.l, unit: "ft" },
        oldest: oldest && { name: oldest.name, val: curYear - oldest.yr, unit: "yrs" },
        most_ridden: mostRiddenId && { name: byId[mostRiddenId].name, val: coasterRides[mostRiddenId], unit: "rides" },
        most_visited_park: mostVisitedPark && { name: mostVisitedPark, val: parkVisitDays[mostVisitedPark], unit: "visits" }
      },
      day_detail: dayDetail,
      geo: { states: [...states].sort(), countries: [...countries].sort(),
             n_states: states.size, n_countries: nCountries, n_parks: parksGeo.length },
      parksGeo: parksGeo,
      byCoaster: (function () {
        var m = {};
        Object.keys(creditIds).forEach(function (id) {
          var dates = rides.filter(function (r) { return r.c == id; }).map(function (r) { return r.d; }).sort();
          m[id] = { rides: dates.length, first: dates[0], last: dates[dates.length - 1], dates: dates };
        });
        return m;
      })(),
      coastersById: byId
    };
  }

  function loadUser(userFile) {
    userFile = userFile || "carter.json";
    return Promise.all([
      fetch("coasters.data.json").then(function (r) { return r.json(); }),
      fetch("parks.json").then(function (r) { return r.json(); }),
      fetch(userFile).then(function (r) { return r.json(); })
    ]).then(function (res) {
      var coasters = res[0].coasters, parks = res[1], user = res[2];
      var stats = computeStats(coasters, parks, user.rides);
      stats.userName = user.user;
      stats.coasters = coasters;
      stats.rides = user.rides;
      return stats;
    });
  }

  var api = { computeStats: computeStats, loadUser: loadUser };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.CoasterHub = api;
})(typeof window !== "undefined" ? window : globalThis);
