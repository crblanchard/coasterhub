/* The recent-changes feed, shared by /changes and the bottom of /riders.
 *
 * It lived inside changes.html until 2026-09-16, when the riders page wanted the
 * same thing underneath its list. Two copies of a hundred lines of sentence
 * building would have drifted the first time an event kind was added, so it
 * moved out here whole. changes.html mounts it with its filter buttons and the
 * full history; /riders mounts a short one with neither.
 *
 *   CoasterHubFeed.mount({ feed: el, note: el, filter: el, limit: 40, poll: true })
 *
 * `feed` is the only required one. Every mount keeps its own events, filter and
 * park lookup, so two on a page would not tread on each other.
 */
(function (global) {
  "use strict";

  function esc(s){ return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function plural(n, one, many){ return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  var ICONS = {
    rides:    '<path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4"/>',
    credits:  '<path d="M12 5v14M5 12h14"/>',
    ranking:  '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/>',
    removed:  '<path d="M5 12h14"/>',
    added:    '<path d="M12 5v14M5 12h14"/>',
    edited:   '<path d="M4 20h4L19 9l-4-4L4 16zM14 5l4 4"/>',
    merged:   '<path d="M7 4v6a4 4 0 0 0 4 4h6M17 10l3 4-3 4"/>',
    deleted:  '<path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/>',
    // Layers: several rides answering as one.
    stack:    '<path d="M12 3 3 8l9 5 9-5-9-5M3 13l9 5 9-5M3 18l9 5 9-5"/>',
    // A person with a tick: somebody is now behind a page that was already here.
    claimed:  '<path d="M15 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M8.5 7a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7M16 11l2 2 4-4"/>'
  };
  // Which of the two feeds an event belongs to: something a rider did to their own
  // count, or something that changed the shared list everyone draws from.
  var RIDER_KINDS = { rides:1, credits:1, ranking:1, ride_removed:1, user_added:1,
                      claimed:1, import:1, day_edited:1 };
  
  function icon(kind){
    var k = kind === 'ride_removed' ? 'removed'
          : kind === 'coaster_added' || kind === 'user_added' ? 'added'
          : kind === 'coaster_edited' || kind === 'coaster_renamed' ? 'edited'
          : kind === 'coaster_merged' ? 'merged'
          : kind === 'clone_removed' ? 'deleted'
          : kind === 'clone_set' ? 'stack'
          : kind === 'model_renamed' ? 'edited'
          : kind === 'model_merged' ? 'merged'
          : kind === 'model_assigned' ? 'edited'
          : kind === 'import' ? 'stack'
          : kind === 'day_edited' ? 'edited'
          : kind === 'park_renamed' ? 'edited'
          : kind === 'park_merged' ? 'merged'
          : kind === 'coaster_deleted' ? 'deleted'
          : kind;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + (ICONS[k] || ICONS.edited) + '</svg>';
  }
  
  // Every sentence is built from what the row actually recorded. Where no rider
  // was known the subject leads instead of a name — see recordActivity in
  // worker.js for why those rows are deliberately anonymous rather than guessed.
  // Which park a rename or a merge happened at. Two names in a sentence and no
  // place is a riddle — "Batgirl was merged into Batgirl Batarang" could be any of
  // the six Six Flags parks that have both.
  //
  // New events carry the park in their detail (see the write paths in worker.js).
  // The 99 backfilled ones never did, but every one of them carries the coaster id
  // it ended up as, so the park is looked up from the coaster list instead. A
  // merge writes that id as `to`; the backfill wrote it as `id`.
  var PARK_BY_ID = null;   // filled in once the coaster list arrives, see load()
  // Which park names are real ones, and which coaster names name exactly one
  // coaster. Both only so a name can be turned into a link it will not 404 on
  // — see the linking block below. Filled in the same place as PARK_BY_ID.
  var PARKS = {}, COASTER_PARK = {};
  function parkName(e){
    var d = e.detail || {};
    return d.park || (PARK_BY_ID && PARK_BY_ID[d.to != null ? d.to : d.id]) || null;
  }
  function parkOf(e){
    var park = parkName(e);
    return park ? ' <span class="at">(' + parkLink(park, esc(park)) + ')</span>' : '';
  }

  // ---- Every name in a sentence is a way in --------------------------------
  // A rider goes to their page, a park to the park, a coaster to the coaster
  // (Carter, 2026-09-20). The hrefs come out of CoasterHub rather than being
  // spelled here, the same rule every other page follows — see the note on
  // userPageHref in app.js.
  //
  // Anything the feed cannot place keeps saying its name plainly rather than
  // linking somewhere that 404s. That is not a rare case: an admin write records
  // no rider, a day out across two parks records "3 parks" where a park name
  // would go, a deleted coaster no longer has a page, and a coaster cannot be
  // addressed at all without its park, because the park leads in the URL. None
  // of them links until the coaster list has landed either — PARKS and
  // COASTER_PARK are empty before that, and the feed is drawn again when it
  // arrives.
  function anchor(u, html){ return u ? '<a href="' + esc(u) + '">' + html + '</a>' : html; }
  function CH(){ return global.CoasterHub || null; }
  function riderLink(slug, html){
    var ch = CH();
    return (slug && ch && ch.userPageHref) ? anchor(ch.userPageHref(slug, 'profile'), html) : html;
  }
  function parkLink(park, html){
    var ch = CH();
    return (park && PARKS[park] && ch && ch.parkHref) ? anchor(ch.parkHref(park), html) : html;
  }
  // A coaster needs its park, which the events carry in three different places:
  // `detail.park` on the ones written since the park was thought worth recording,
  // the coaster list by id for the rest, and — for a removed ride, which records
  // neither — the name itself, but ONLY when it names one coaster. 93 names in
  // the database are used at more than one park, and a link to the wrong Wacky
  // Worm is worse than no link at all.
  function rideLink(name, park, html){
    var ch = CH();
    if (!park && name) park = COASTER_PARK[name] || null;
    return (name && park && ch && ch.coasterHref) ? anchor(ch.coasterHref(name, park), html) : html;
  }
  
  function sentence(e){
    var who = e.actorName ? riderLink(e.actor, '<b>' + esc(e.actorName) + '</b>') : null;
    var d = e.detail || {};
    var sub = e.subject ? '<span class="sub">' + esc(e.subject) + '</span>' : null;
    // Where the subject of this event IS a coaster, the park it stands at.
    var park = parkName(e);
  
    if (e.kind === 'rides') {
      var s = (who || 'Someone') + ' logged ' + plural(d.rides || e.n || 0, 'ride');
      if (sub) s += ' at ' + parkLink(e.subject, sub);
      if (d.date) s += ' on ' + niceDate(d.date);
      if (d.newCredits) s += ' &mdash; ' + plural(d.newCredits, 'new credit');
      return s;
    }
    // A whole count arriving at once. Twenty calls to keep the dates, one line
    // to read. (Carter, 2026-09-20.)
    if (e.kind === 'import') {
      // A list of the days, or just how many there were — the repair that
      // collapsed the twenty rows Nick's import wrote could not reasonably
      // carry nineteen dates through a console paste.
      var days = Array.isArray(d.days) ? d.days.length : (+d.days || 0);
      return (who || 'Someone') + ' imported ' + plural(e.n || 0, 'credit')
        + (days ? ' <span class="sub">across ' + plural(days, 'day') + '</span>' : '');
    }
    // A logged day changed after the fact: laps, a coaster on or off it, or the
    // date itself. Says what moved and where it ended up; the row count after
    // is in `n` for anyone who wants it, but "changed" is the news.
    if (e.kind === 'day_edited') {
      var moves = [];
      if (d.added) moves.push('added ' + plural(d.added, 'ride'));
      if (d.removed) moves.push('removed ' + plural(d.removed, 'ride'));
      if (d.to) moves.push('moved it to ' + niceDate(d.to));
      return (who || 'Someone') + ' changed ' + (d.date ? niceDate(d.date) : 'a day')
        + (sub ? ' at ' + parkLink(e.subject, sub) : '')
        + (moves.length ? ' \u2014 ' + moves.join(', ') : '');
    }
    if (e.kind === 'credits') {
      var n = d.rides || e.n || 0;
      return (who || 'Someone') + ' added ' + plural(n, 'coaster') + ' to their count';
    }
    if (e.kind === 'ride_removed') {
      return (who || 'Someone') + ' removed a ride'
        + (sub ? ' of ' + rideLink(e.subject, null, sub) : '');
    }
    if (e.kind === 'ranking') {
      var bits = [];
      if (d.added) bits.push('ranked ' + plural(d.added, 'new coaster'));
      // Ranking something you had not logged adds it to your count (see
      // creditRanked in worker.js), and a count moving is worth saying out loud.
      if (d.credited) bits.push('picked up ' + plural(d.credited, 'new credit'));
      if (d.removed) bits.push('dropped ' + plural(d.removed, 'coaster'));
      if (!bits.length) bits.push('reordered their rankings');
      return (who || 'Someone') + ' ' + bits.join(' and ')
        + (d.total ? ' <span class="sub">(' + d.total + ' ranked)</span>' : '');
    }
    if (e.kind === 'coaster_added')   return (sub ? rideLink(e.subject, park, sub) : 'A coaster')
      + ' was added' + (d.park ? ' at ' + parkLink(d.park, esc(d.park)) : '');
    if (e.kind === 'coaster_renamed') return (d.from ? esc(d.from) : 'A coaster')
      + ' was renamed to ' + (sub ? rideLink(e.subject, park, sub) : 'something else') + parkOf(e);
    if (e.kind === 'coaster_merged'){
      // The live path records the name it merged away as `fromName` and keeps `from`
      // for the id; the backfill put the NAME in `from`. Read both, or 44 rows of
      // history say "A duplicate" when they know exactly what it was called.
      var gone = d.fromName || (typeof d.from === 'string' ? d.from : null);
      return (gone ? esc(gone) : 'A duplicate')
        + ' was merged into ' + (sub ? rideLink(e.subject, park, sub) : 'another coaster') + parkOf(e);
    }
    if (e.kind === 'coaster_deleted'){
      // Deleted with riders' rides on it (?dropRides=1 — not a roller coaster):
      // the row names them, and so does the sentence, since their counts moved.
      var lost = d.riders || [], nr = d.rides || lost.length;
      return (sub || 'A coaster') + ' was deleted' + parkOf(e)
        + (lost.length ? ' — the ' + nr + ' ride' + (nr === 1 ? '' : 's') + ' on it by '
            + lost.map(function(r){ return riderLink(r.slug, esc(r.name || r.slug)); }).join(', ')
            + ' went with it' : '');
    }
    if (e.kind === 'clone_set'){
      var made = !!d.made, again = (d.saves || 1) > 1;
      return (sub || 'A category') + ' category '
        + (made && again ? 'created and modified' : made ? 'created' : 'modified');
    }
    if (e.kind === 'clone_removed') return (sub || 'A category') + ' category deleted';
    if (e.kind === 'model_renamed') return esc(d.from || 'A model') + ' is now '
      + (sub || 'something else') + ' \u2014 ' + plural(e.n || 0, 'coaster');
    // A park rename moves every coaster standing in it, so the count is the
    // part worth saying — unlike a coaster rename, where the ride is the story.
    if (e.kind === 'park_renamed') return esc(d.from || 'A park') + ' is now '
      + (sub ? parkLink(e.subject, sub) : 'something else') + (e.n ? ' — ' + e.n + ' coaster' + (e.n === 1 ? '' : 's') + ' moved' : '');
    if (e.kind === 'park_merged') return esc(d.from || 'A park') + ' was merged into '
      + (sub ? parkLink(e.subject, sub) : 'another park') + (e.n ? ' — ' + e.n + ' coaster' + (e.n === 1 ? '' : 's') + ' moved' : '');
    if (e.kind === 'model_merged') return esc(d.from || 'A model') + ' was merged into '
      + (sub || 'another model') + ' \u2014 ' + plural(e.n || 0, 'coaster') + ' moved';
    // Coasters moved onto a model one handful at a time, which is the half of
    // the tidying a rename cannot do. `from` is only recorded when they all
    // came off the same name, so the sentence loses it rather than guessing.
    if (e.kind === 'model_assigned') return sub
      ? plural(e.n || 0, 'coaster')
        + (d.from ? ' moved from ' + esc(d.from) + ' to ' : ' given the model ') + sub
      : plural(e.n || 0, 'coaster') + ' no longer '
        + ((e.n || 0) === 1 ? 'carries' : 'carry') + ' a model';
    // The rider's name and the address of their page both go to it. Two links
    // to one place in a sentence of six words, and that is right: whichever of
    // the two somebody reads as the name of the person, it is the way there.
    var at = e.actor ? ' ' + riderLink(e.actor, '<span class="sub">/user/' + esc(e.actor) + '</span>') : '';
    if (e.kind === 'user_added')      return (sub ? riderLink(e.actor, sub) : 'A rider') + ' joined' + at;
    if (e.kind === 'claimed')         return (sub ? riderLink(e.actor, sub) : 'A rider')
      + ' created an account' + at;
    if (e.kind === 'user_renamed')    return (sub || 'A rider') + ' is now '
      + (e.actor ? riderLink(e.actor, '<b>' + esc(e.actor) + '</b>') + at : 'somebody else');
    if (e.kind === 'coaster_edited')  return (sub ? rideLink(e.subject, park, sub) : 'A coaster') + ' had '
      + plural(e.n || (d.fields || []).length || 1, 'detail') + ' updated';
    return esc(e.kind);
  }
  
  function niceDate(iso){
    var d = new Date(iso + 'T00:00');
    if (isNaN(d)) return esc(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  
  // `at` comes in two shapes: an ISO instant for anything this feed recorded, and
  // a bare YYYY-MM-DD for the backfilled rows, which never had a time. They have
  // to be read differently or the day headings go out of order: new Date("2026-08-05")
  // is midnight UTC, which is the 4th in any western timezone, so a dated row and
  // a backfilled row from the same day landed under two different headings — and
  // the server sorts them as strings, which interleaves the two formats. Parse the
  // bare ones as LOCAL midnight, then sort on the parsed value here.
  function isDayOnly(iso){ return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')); }
  function atTime(iso){ return new Date(isDayOnly(iso) ? (iso + 'T00:00') : iso).getTime(); }
  function dayKey(iso){ return new Date(atTime(iso)).toLocaleDateString(undefined,
    { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
  // A backfilled row has no time to show, and inventing midnight for it would be
  // a fact this feed does not have.
  function clock(iso){ return isDayOnly(iso) ? '' : new Date(atTime(iso)).toLocaleTimeString(undefined,
    { hour: 'numeric', minute: '2-digit' }); }
  
  // Bursts are merged when they are written (see recordRanking and recordCredits
  // in worker.js), which leaves the rows already in the table ungrouped. Fold
  // those together the same way on the way in: one rider's events of the same
  // kind chain into a single line while each is within an hour of the one
  // before it, reported at the newest timestamp. Chaining rather than a fixed
  // window is deliberate — an hour of steady work is one sitting, however many
  // times it was saved.
  //
  // Two kinds group, and the third deliberately does not. Ranking and adding
  // credits are both one job done in installments: nobody means "I did six
  // separate things" by ticking a park's list in six saves. A dated RIDE is
  // different — each one is a day out, at a named park, and reads as a fact on
  // its own.
  //
  // A category is the third: it is edited a few times in a row while you get it
  // right, and six rows saying "Batman clones category modified" is noise about
  // one afternoon's decision. It chains on the SUBJECT rather than the actor,
  // because the actor on an admin write is nobody.
  var GROUP_MS = 60 * 60 * 1000;
  var GROUPS = { ranking: 1, credits: 1, clone_set: 1 };
  var BY_SUBJECT = { clone_set: 1 };
  function groupRuns(list){
    var out = [];
    list.forEach(function(e){
      var last = out[out.length - 1];
      var same = BY_SUBJECT[e.kind] ? (last && last.subject === e.subject)
                                    : (last && last.actor === e.actor);
      if (GROUPS[e.kind] && last && last.kind === e.kind && same
          && !isDayOnly(e.at) && !isDayOnly(last.at)
          && atTime(last.at) - atTime(e.at) < GROUP_MS) {
        var a = last.detail || {}, b = e.detail || {};
        // Whichever half of the run created it, the run created it. `last` is
        // the newer, so its member count is the one that survives.
        if (e.kind === 'clone_set') {
          last.detail = { made: !!(a.made || b.made), saves: (a.saves || 1) + (b.saves || 1) };
          return;
        }
        // `last` is the newer of the two (the list is newest-first), so its
        // running total and its timestamp are the ones that survive.
        if (e.kind === 'ranking') {
          last.detail = {
            added: (a.added || 0) + (b.added || 0),
            removed: (a.removed || 0) + (b.removed || 0),
            reordered: !!(a.reordered || b.reordered),
            credited: (a.credited || 0) + (b.credited || 0),
            total: a.total,
            saves: (a.saves || 1) + (b.saves || 1)
          };
        } else {
          // Credits have no running total to keep; the counts simply add up.
          // `n` is summed as well as detail.rides because a row written before
          // this had a detail carries only n, and the sentence reads whichever
          // it finds.
          last.detail = {
            rides: (a.rides || 0) + (b.rides || 0),
            coasters: (a.coasters || 0) + (b.coasters || 0),
            newCredits: (a.newCredits || 0) + (b.newCredits || 0),
            saves: (a.saves || 1) + (b.saves || 1)
          };
          last.n = (a.rides ? 0 : (last.n || 0)) + (b.rides ? 0 : (e.n || 0));
        }
        return;
      }
      out.push(Object.assign({}, e, { detail: Object.assign({}, e.detail) }));
    });
    return out;
  }

  function mount(opts) {
    var feedEl = opts && opts.feed;
    if (!feedEl) return null;
    var noteEl = opts.note || null, filterEl = opts.filter || null;
    var limit = opts.limit || 0;
    var EVENTS = [], FILTER = 'all';

    function render(){
      var list = groupRuns(EVENTS.filter(function(e){
        if (FILTER === 'riders')   return !!RIDER_KINDS[e.kind];
        if (FILTER === 'database') return !RIDER_KINDS[e.kind];
        return true;
      }));
      if (limit) list = list.slice(0, limit);
      if (!list.length){
        feedEl.innerHTML = '<div class="empty">Nothing here yet.</div>';
        return;
      }
      var html = '', lastDay = null;
      list.forEach(function(e){
        var k = dayKey(e.at);
        if (k !== lastDay){ html += '<div class="day">' + esc(k) + '</div>'; lastDay = k; }
        html += '<div class="ev' + (RIDER_KINDS[e.kind] ? ' log' : '') + '">'
          + '<span class="ic">' + icon(e.kind) + '</span>'
          + '<span class="tx">' + sentence(e) + '</span>'
          + '<span class="when">' + esc(clock(e.at)) + '</span>'
          + '</div>';
      });
      feedEl.innerHTML = html;
    }

    if (filterEl) {
      Array.prototype.forEach.call(filterEl.querySelectorAll('button'), function(b){
        b.addEventListener('click', function(){
          Array.prototype.forEach.call(filterEl.querySelectorAll('button'), function(x){
            x.classList.toggle('on', x === b);
          });
          FILTER = b.getAttribute('data-f');
          render();
        });
      });
    }

    function load(quiet){
      // A short list (the home page) needs only enough rows to fold into its few
      // lines, not the 300 /changes reads: ranking saves and credit bursts fold
      // together, so a few rows per line is plenty.
      return fetch('/api/activity?limit=' + (limit ? Math.max(40, limit * 8) : 300))
        .then(function(r){ if (!r.ok) throw new Error('api ' + r.status); return r.json(); })
        .then(function(j){
          // Sort here rather than trusting the order back: the two `at` formats are
          // sorted as strings by SQL, which interleaves them. See atTime above.
          EVENTS = (j.events || []).slice().sort(function(a, b){ return atTime(b.at) - atTime(a.at); });
          if (noteEl) {
            // Say plainly where the history starts. Nothing before the feed shipped was
            // timestamped anywhere, so the older entries are reconstructed from the
            // alias table and carry a date but not a time or a name.
            var back = EVENTS.filter(function(e){ return e.detail && e.detail.backfilled; }).length;
            noteEl.innerHTML = back
              ? 'Recorded as it happens. The ' + back + ' oldest entries were rebuilt from the '
                + 'record of former names &mdash; those have a date but no time, and no-one attached, '
                + 'because nothing before this page existed was ever timestamped.'
              : 'Recorded as it happens.';
          }
          render();
        })
        .catch(function(){
          // A failed refresh must not wipe a feed that is already on screen.
          if (!quiet) feedEl.innerHTML = '<div class="empty">Couldn&rsquo;t load recent changes.</div>';
        });
    }
    load(false);

    // The coaster list, only so a rename or a merge can say which park it was at.
    // Fetched alongside the feed rather than before it: the feed is what the page is
    // for, and it should not wait on 1,100 coasters to draw. When the list lands the
    // feed is drawn again with the parks filled in. A failure here is silent — the
    // sentences simply stay as they were.
    if (global.CoasterHub && global.CoasterHub.fetchCoasters) {
      global.CoasterHub.fetchCoasters().then(function(res){
        PARK_BY_ID = {}; PARKS = {}; COASTER_PARK = {};
        (res.coasters || []).forEach(function(c){
          if (c.park){ PARK_BY_ID[c.id] = c.park; PARKS[c.park] = 1; }
          if (!c.name) return;
          // Second sighting of a name means it names two coasters, and a link
          // built from the name alone would be a coin toss. Null it rather than
          // letting the last one win.
          COASTER_PARK[c.name] = Object.prototype.hasOwnProperty.call(COASTER_PARK, c.name)
            ? null : (c.park || null);
        });
        if (EVENTS.length) render();
      }).catch(function(){});
    }

    // Keep it live. Ranking in another tab merges into one line here as you work, so
    // the page is worth watching rather than reloading. Only while it is on screen —
    // a background tab polling forever is rude to the phone it is sitting on.
    if (opts.poll) {
      setInterval(function(){ if (document.visibilityState === 'visible') load(true); }, 60000);
      document.addEventListener('visibilitychange', function(){
        if (document.visibilityState === 'visible') load(true);
      });
    }
    return { reload: load, render: render };
  }

  global.CoasterHubFeed = { mount: mount };
})(typeof window !== "undefined" ? window : globalThis);
