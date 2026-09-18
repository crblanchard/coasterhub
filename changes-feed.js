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
    // A person with a tick: somebody is now behind a page that was already here.
    claimed:  '<path d="M15 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M8.5 7a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7M16 11l2 2 4-4"/>'
  };
  // Which of the two feeds an event belongs to: something a rider did to their own
  // count, or something that changed the shared list everyone draws from.
  var RIDER_KINDS = { rides:1, credits:1, ranking:1, ride_removed:1, user_added:1, claimed:1 };
  
  function icon(kind){
    var k = kind === 'ride_removed' ? 'removed'
          : kind === 'coaster_added' || kind === 'user_added' ? 'added'
          : kind === 'coaster_edited' || kind === 'coaster_renamed' ? 'edited'
          : kind === 'coaster_merged' ? 'merged'
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
  function parkOf(e){
    var d = e.detail || {};
    var park = d.park || (PARK_BY_ID && PARK_BY_ID[d.to != null ? d.to : d.id]);
    return park ? ' <span class="at">(' + esc(park) + ')</span>' : '';
  }
  
  function sentence(e){
    var who = e.actorName ? '<b>' + esc(e.actorName) + '</b>' : null;
    var d = e.detail || {};
    var sub = e.subject ? '<span class="sub">' + esc(e.subject) + '</span>' : null;
  
    if (e.kind === 'rides') {
      var s = (who || 'Someone') + ' logged ' + plural(d.rides || e.n || 0, 'ride');
      if (sub) s += ' at ' + sub;
      if (d.date) s += ' on ' + niceDate(d.date);
      if (d.newCredits) s += ' &mdash; ' + plural(d.newCredits, 'new credit');
      return s;
    }
    if (e.kind === 'credits') {
      var n = d.rides || e.n || 0;
      return (who || 'Someone') + ' added ' + plural(n, 'coaster') + ' to their count';
    }
    if (e.kind === 'ride_removed') {
      return (who || 'Someone') + ' removed a ride' + (sub ? ' of ' + sub : '');
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
    if (e.kind === 'coaster_added')   return (sub || 'A coaster') + ' was added'
      + (d.park ? ' at ' + esc(d.park) : '');
    if (e.kind === 'coaster_renamed') return (d.from ? esc(d.from) : 'A coaster')
      + ' was renamed to ' + (sub || 'something else') + parkOf(e);
    if (e.kind === 'coaster_merged'){
      // The live path records the name it merged away as `fromName` and keeps `from`
      // for the id; the backfill put the NAME in `from`. Read both, or 44 rows of
      // history say "A duplicate" when they know exactly what it was called.
      var gone = d.fromName || (typeof d.from === 'string' ? d.from : null);
      return (gone ? esc(gone) : 'A duplicate')
        + ' was merged into ' + (sub || 'another coaster') + parkOf(e);
    }
    if (e.kind === 'coaster_deleted') return (sub || 'A coaster') + ' was deleted';
    if (e.kind === 'user_added')      return (sub || 'A rider') + ' joined'
      + (e.actor ? ' <span class="sub">/user/' + esc(e.actor) + '</span>' : '');
    if (e.kind === 'claimed')         return (sub || 'A rider') + ' created an account'
      + (e.actor ? ' <span class="sub">/user/' + esc(e.actor) + '</span>' : '');
    if (e.kind === 'user_renamed')    return (sub || 'A rider') + ' is now '
      + (e.actor ? '<b>' + esc(e.actor) + '</b> <span class="sub">/user/' + esc(e.actor) + '</span>'
                 : 'somebody else');
    if (e.kind === 'coaster_edited')  return (sub || 'A coaster') + ' had '
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
  var GROUP_MS = 60 * 60 * 1000;
  var GROUPS = { ranking: 1, credits: 1 };
  function groupRuns(list){
    var out = [];
    list.forEach(function(e){
      var last = out[out.length - 1];
      if (GROUPS[e.kind] && last && last.kind === e.kind && last.actor === e.actor
          && !isDayOnly(e.at) && !isDayOnly(last.at)
          && atTime(last.at) - atTime(e.at) < GROUP_MS) {
        var a = last.detail || {}, b = e.detail || {};
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
      return fetch('/api/activity?limit=300')
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
        PARK_BY_ID = {};
        (res.coasters || []).forEach(function(c){ if (c.park) PARK_BY_ID[c.id] = c.park; });
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
