/* Your own profile, editable in place.
 *
 * This used to be the signed-in half of /account. It lives here because it now
 * renders on your own /stats page instead — Carter's call, 2026-09-15: one page
 * for "you", not a profile page plus an account page saying similar things.
 * /account is signed-out only now: sign in, sign up, claim an invite, reset a
 * password.
 *
 * mount(el, account) renders the card into `el` and wires it. Everything is
 * scoped inside that element, so the page around it needs no ids of its own,
 * and the styles are under `.profedit` in style.css rather than global — a bare
 * `input{}` rule would otherwise reach into /log and /add.
 */
(function (global) {
  "use strict";

  var BIO_MAX = 280;
  var PIC_PX = 256;                       // what gets uploaded, after cropping
  // Where the crop window starts. `base` in openCrop is COVER, which sounds
  // like a sensible default and is the widest possible crop: on a 600x800 the
  // square it frames is the photo's entire 600px width, and on an 800x600 it is
  // the entire 600px height. Either way a person in a phone photo is a small
  // part of it, so the default framed the scene rather than the person and the
  // only cure was knowing to zoom before pressing OK.
  //
  // So the window opens at FRAME of the photo's SHORTER edge — zoom 1.43 of
  // cover — whichever way round the photo is. The first pass at this only did
  // it for tall photos, on the reasoning that a wide one is already tight at
  // cover; it isn't, it is merely less loose, and Carter's own photo is the
  // proof: he re-cropped, the branch never fired, and it came out the same.
  // (2026-09-21, "no way it still didn't work it looks the same".)
  //
  // The slider still goes back to 100% for the whole frame, so nothing is out
  // of reach — the starting point is just the useful one.
  //
  // The crop MATHS was never the problem here: tools/test-crop.mjs drives the
  // real dialog with a real EXIF-rotated JPEG and proves the saved file is the
  // region the preview showed.
  var FRAME = 0.70;                       // crop side, as a fraction of the short edge
  // Vertically, a tall photo is anchored on where a face is rather than on the
  // middle of the frame; a wide or square one is not, because a face in a wide
  // photo is already near its middle.
  var TALL_EYELINE = 0.32;

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // The identity block, which every profile page gets — yours and everyone
  // else's. The only difference is whether the pieces are buttons that open an
  // editor or plain text, so a visitor sees the same profile you do, minus the
  // pencils and the things that are nobody's business but yours.
  function HEAD(editable) {
    if (!editable) {
      return ''
        + '<div class="who">'
        +   '<div class="av" data-el="av"></div>'
        +   '<div style="min-width:0">'
        +     '<div class="nm" data-el="name"></div>'
        +     '<div class="un" data-el="user"></div>'
        +   '</div>'
        + '</div>'
        + '<p class="bioline" data-el="bio"></p>';
    }
    return ''
      + '<div class="who">'
      +   '<button class="av edit" data-el="av" type="button" title="Change your picture"'
      +     ' aria-label="Change your profile picture"></button>'
      +   '<div style="min-width:0">'
      +     '<button class="nm edit" data-el="name" type="button" title="Change your display name"'
      +       ' aria-label="Change your display name"></button>'
      +     '<button class="un edit" data-el="user" type="button" title="Change your username"'
      +       ' aria-label="Change your username"></button>'
      +     '<div class="em" data-el="email"></div>'
      +   '</div>'
      + '</div>'
      + '<button class="bioline edit" data-el="bio" type="button" title="Change your bio"'
      +   ' aria-label="Change your bio"></button>';
  }

  function CARD() {
    return HEAD(true)

      + '<div class="panel" data-panel="pic" hidden>'
      +   '<div class="picrow">'
      +     '<div class="av big" data-el="picprev"></div>'
      +     '<div style="flex:1;min-width:0">'
      /* image/*, not a list of types: a photo off an iPhone or a Mac is HEIC,
         and naming png/jpeg/webp greys it out in the picker so it cannot even
         be chosen. The canvas converts whatever it can decode to JPEG. */
      +       '<input type="file" accept="image/*" data-el="file" style="display:none">'
      +       '<button class="ghost" type="button" data-el="pick" style="width:100%;margin-bottom:8px">Choose a picture</button>'
      +       '<button class="ghost" type="button" data-el="clear" style="width:100%">Remove</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="msg" data-msg="pic"></div>'
      + '</div>'

      + '<div class="panel" data-panel="name" hidden><form data-form="name">'
      +   '<label>Display name<input type="text" maxlength="40" data-el="nametext" required></label>'
      +   '<p class="hint">What the site calls you. Spaces, capitals and accents are all fine, and'
      +     ' it does not have to be unique.</p>'
      +   '<button class="primary" type="submit" data-el="namego">Save name</button>'
      +   '<div class="msg" data-msg="name"></div>'
      + '</form></div>'

      + '<div class="panel" data-panel="bio" hidden><form data-form="bio">'
      +   '<label>Bio<textarea maxlength="' + BIO_MAX + '" rows="3" data-el="biotext"'
      +     ' placeholder="A line about your riding — shown on your profile."></textarea></label>'
      +   '<p class="hint"><span data-el="bioleft">' + BIO_MAX + '</span> characters left.</p>'
      +   '<button class="primary" type="submit" data-el="biogo">Save bio</button>'
      +   '<div class="msg" data-msg="bio"></div>'
      + '</form></div>'

      + '<div class="panel" data-panel="user" hidden><form data-form="user">'
      +   '<label>Username<input type="text" maxlength="32" autocapitalize="off" autocorrect="off"'
      +     ' spellcheck="false" data-el="usertext" required></label>'
      +   '<p class="hint" data-el="userurl">Your page address.</p>'
      +   '<p class="hint">Changing this moves your page. Your rides, rankings and sign-in all come'
      +     ' with you, but the old address stops working &mdash; it does not redirect.</p>'
      +   '<button class="primary" type="submit" data-el="usergo">Save</button>'
      +   '<div class="msg" data-msg="user"></div>'
      + '</form></div>'

      // Log a day is not in this card, but it IS on this page: stats.html puts
      // the button up in the hero beside the count, where the number it changes
      // is. This card is who you are, not what you do.
      + '<div class="panel" data-panel="pw" hidden><form data-form="pw">'
      +   '<label>Current password<input type="password" autocomplete="current-password"'
      +     ' data-el="pwcur" required></label>'
      +   '<label>New password<input type="password" autocomplete="new-password"'
      +     ' data-el="pwnew" required></label>'
      +   '<label>Confirm new password<input type="password" autocomplete="new-password"'
      +     ' data-el="pwnew2" required></label>'
      +   '<p class="hint">Signs you out everywhere else.</p>'
      +   '<button class="primary" type="submit" data-el="pwgo">Change it</button>'
      +   '<div class="msg" data-msg="pw"></div>'
      + '</form></div>'

      + '<div class="ownrow">'
      +   '<button class="ghost" data-el="pwbtn">Change password</button>'
      +   '<button class="ghost" data-el="signout">Sign out</button>'
      + '</div>'
      + '<div class="msg" data-msg="out"></div>';
  }

  // The crop window lives at the end of <body>, not inside the card: it covers
  // the page, and nesting it in something that might be hidden or clipped is
  // how a dialog ends up invisible or trapped inside an overflow.
  function CROPBOX() {
    return ''
      + '<div class="cropbox">'
      +   '<h2>Crop your picture</h2>'
      +   '<p class="sub">Drag to move it. Scroll, pinch or use the slider to zoom.</p>'
      +   '<div class="cropview" data-el="view"><canvas class="cropimg" data-el="img"></canvas>'
      +     '<div class="cropmask" aria-hidden="true"></div></div>'
      +   '<label style="margin-top:14px">Zoom<input type="range" min="100" max="300" value="100"'
      +     ' step="1" data-el="zoom"></label>'
      +   '<div class="croprow">'
      +     '<button class="ghost" type="button" data-el="cancel">Cancel</button>'
      +     '<button class="primary" type="button" data-el="ok" style="width:auto;flex:1">Use this picture</button>'
      +   '</div>'
      +   '<div class="msg" data-msg="crop"></div>'
      + '</div>';
  }

  // mount(el, profile, opts)
  //   opts.editable  this is the signed-in owner, so render the editors
  //   opts.onRename  the page IS this rider; move the address bar
  function mount(root, account, opts) {
    opts = opts || {};
    var me = account || {};
    var editable = !!opts.editable;
    root.classList.add("profedit");
    root.innerHTML = editable ? CARD() : HEAD(false);

    var el = {};
    root.querySelectorAll("[data-el]").forEach(function (n) { el[n.getAttribute("data-el")] = n; });
    var msg = {};
    root.querySelectorAll("[data-msg]").forEach(function (n) { msg[n.getAttribute("data-msg")] = n; });
    var panel = {};
    root.querySelectorAll("[data-panel]").forEach(function (n) { panel[n.getAttribute("data-panel")] = n; });

    function say(box, text, ok) {
      box.textContent = text || "";
      box.className = "msg " + (ok ? "ok" : "bad");
    }
    // Saved, so the editor gets out of the way — but not instantly, or the
    // confirmation it just printed vanishes before anyone reads it.
    function closeSoon(name) { setTimeout(function () { panel[name].hidden = true; }, 1100); }

    function post(path, body, method) {
      return fetch(path, {
        method: method || "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: body === undefined ? undefined : JSON.stringify(body),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) throw new Error(d.error || ("Something went wrong (" + r.status + ")."));
          return d;
        });
      });
    }
    function wire(form, button, box, build, path, done) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var body = build();
        if (!body) return;
        button.disabled = true;
        say(box, "");
        post(path, body).then(done)
          .catch(function (err) { say(box, err.message); })
          .then(function () { button.disabled = false; });
      });
    }

    // ---- what the card shows -------------------------------------------------
    function paintAvatar(node) {
      if (me.avatar) {
        node.style.backgroundImage = 'url("/avatars/' + me.avatar + '")';
        node.textContent = "";
      } else {
        node.style.backgroundImage = "";
        node.textContent = String(me.name || me.slug || "?").trim().charAt(0).toUpperCase();
      }
    }
    function paintBio() {
      // Someone else's empty bio is nothing to say, so it takes up no room.
      // Your own invites, because an editable thing showing nothing is
      // impossible to find.
      if (!editable) {
        el.bio.textContent = me.bio || "";
        el.bio.style.display = me.bio ? "" : "none";
        return;
      }
      el.bio.textContent = me.bio || "Add a short bio";
      el.bio.classList.toggle("empty", !me.bio);
    }
    function paintUrl(slug) {
      var clean = String(slug || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      el.userurl.textContent = clean ? "Your page: coasterhub.org/user/" + clean : "Your page address.";
    }
    function render() {
      el.name.textContent = me.name || me.slug || "Your account";
      el.user.textContent = me.slug ? "@" + me.slug : "";
      paintAvatar(el.av); paintBio();
      // Everything past here only exists on your own card.
      if (!editable) return;
      // An email address is nobody's business but its owner's, so it is only
      // ever rendered for the person it belongs to.
      el.email.textContent = me.email || "";
      paintAvatar(el.picprev);
      el.nametext.value = me.name || "";
      el.biotext.value = me.bio || "";
      el.usertext.value = me.slug || "";
      el.usertext.defaultValue = me.slug || "";
      el.bioleft.textContent = String(BIO_MAX - (me.bio || "").length);
      paintUrl(me.slug);
    }

    // A visitor gets the identity and nothing else: no editors, no crop window,
    // no password form, no listeners. Returning here rather than hiding things
    // afterwards means none of that is ever built.
    if (!editable) { render(); return { render: render, account: me }; }

    // ---- one editor at a time ------------------------------------------------
    var NAMES = ["pic", "name", "bio", "user", "pw"];
    function open(which) {
      NAMES.forEach(function (n) { panel[n].hidden = (n !== which); });
      if (which === "name") el.nametext.focus();
      if (which === "user") el.usertext.focus();
      if (which === "bio") el.biotext.focus();
    }
    [["av", "pic"], ["name", "name"], ["user", "user"], ["bio", "bio"]].forEach(function (pair) {
      el[pair[0]].addEventListener("click", function () {
        open(panel[pair[1]].hidden ? pair[1] : null);
      });
    });

    // ---- the simple forms ----------------------------------------------------
    wire(root.querySelector('[data-form="name"]'), el.namego, msg.name,
      function () { return { name: el.nametext.value }; },
      "/api/account/profile",
      function (d) {
        me.name = d.name; render();
        say(msg.name, "Name saved.", true); closeSoon("name");
        if (opts.onChange) opts.onChange(me);
      });

    el.biotext.addEventListener("input", function () {
      el.bioleft.textContent = String(BIO_MAX - this.value.length);
    });
    wire(root.querySelector('[data-form="bio"]'), el.biogo, msg.bio,
      function () { return { bio: el.biotext.value }; },
      "/api/account/profile",
      function (d) {
        me.bio = d.bio; render();
        say(msg.bio, d.bio ? "Bio saved." : "Bio cleared.", true); closeSoon("bio");
        if (opts.onChange) opts.onChange(me);
      });

    el.usertext.addEventListener("input", function () { paintUrl(this.value); });
    wire(root.querySelector('[data-form="user"]'), el.usergo, msg.user,
      function () {
        var slug = el.usertext.value.trim().toLowerCase();
        // Renaming moves a public URL and leaves no forwarding address, so the
        // confirm says exactly that rather than something softer.
        if (slug && slug !== (el.usertext.defaultValue || "").toLowerCase() &&
            !confirm("Change your username to " + slug + "?\n\nYour page moves to /user/" + slug +
                     ". Your old address stops working straight away — any link to it will 404, " +
                     "and the old name becomes free for someone else to take.\n\nEverything you " +
                     "have logged moves with you.")) {
          return null;
        }
        return { username: slug };
      },
      "/api/account/profile",
      function (d) {
        me.slug = d.slug;
        el.usertext.defaultValue = d.slug;
        render();
        try { localStorage.setItem("ch_rider", d.slug); } catch (e) {}
        say(msg.user, d.renamed ? "Saved. Your page is now /user/" + d.slug
                                : "That is already your username.", true);
        closeSoon("user");
        // The page is about this rider and its URL just changed, so the address
        // bar has to follow or a refresh 404s.
        if (d.renamed && opts.onRename) opts.onRename(d.slug);
        if (opts.onChange) opts.onChange(me);
      });

    wire(root.querySelector('[data-form="pw"]'), el.pwgo, msg.pw,
      function () {
        if (el.pwnew.value !== el.pwnew2.value) {
          say(msg.pw, "Those two passwords are not the same.");
          return null;
        }
        return { current: el.pwcur.value, password: el.pwnew.value };
      },
      "/api/auth/password",
      function () {
        el.pwcur.value = el.pwnew.value = el.pwnew2.value = "";
        say(msg.pw, "Password changed.", true);
        closeSoon("pw");
      });

    el.pwbtn.addEventListener("click", function () {
      open(panel.pw.hidden ? "pw" : null);
      if (!panel.pw.hidden) el.pwcur.focus();
    });

    el.signout.addEventListener("click", function () {
      el.signout.disabled = true;
      post("/api/auth/logout", {})
        .then(function () { location.href = "/"; })
        .catch(function () {
          el.signout.disabled = false;
          say(msg.out, "Could not sign out — try again.");
        });
    });

    // ---- the picture, and the crop window ------------------------------------
    var wrap = document.createElement("div");
    wrap.className = "cropwrap";
    wrap.hidden = true;
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", "Crop your picture");
    wrap.innerHTML = CROPBOX();
    document.body.appendChild(wrap);
    var c = {};
    wrap.querySelectorAll("[data-el]").forEach(function (n) { c[n.getAttribute("data-el")] = n; });
    var cropMsg = wrap.querySelector('[data-msg="crop"]');

    var CROP = { img: null, zoom: 1, x: 0, y: 0, base: 1, vw: 0 };

    // The working copy is a CANVAS, never the <img>, and this is the whole
    // reason avatars came out cropped wrong from a phone.
    //
    // A photo taken upright on a phone is not stored upright. It is a landscape
    // bitmap — 4032x3024 — plus an EXIF tag saying "rotate this 90 degrees".
    // Browsers apply that when they DISPLAY the <img>, so naturalWidth/Height
    // report the upright 3024x4032 and the preview, which is CSS background
    // sizing, looks perfectly right. But drawImage()'s nine-argument form, the
    // one that takes a source rectangle, has a long history in WebKit of reading
    // those coordinates in the RAW unrotated space. The preview then frames one
    // region and the canvas saves a different, rotated one, and no amount of
    // dragging fixes it because both halves are behaving consistently with
    // themselves.
    //
    // It is invisible to a test: a synthetic PNG carries no EXIF at all, so
    // Chromium and every check run here agreed the maths was right. It was.
    //
    // Baking the photo onto a canvas first settles it by construction. The
    // browser applies the orientation once, in the plain three-argument draw
    // that every engine gets right, and a canvas carries no metadata — so every
    // measurement after this point and the final crop are in the same space.
    // The copy is also capped at BAKE_MAX on its long edge: the output is 256px
    // so nothing is lost, and it keeps a 12-megapixel photo well under iOS's
    // canvas limits.
    var BAKE_MAX = 1800;

    function loadImage(file) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () { resolve(img); };
        // Chrome cannot decode HEIC; Safari can. Say which file and what to do,
        // rather than "not an image", which is unhelpful and untrue.
        img.onerror = function () {
          reject(new Error("This browser cannot read " + (file.name || "that file") +
            ". If it is a HEIC photo, export it as JPEG first, or try Safari."));
        };
        img.src = URL.createObjectURL(file);
      }).then(bake);
    }

    function bake(img) {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h) throw new Error("that image has no size");
      var k = Math.min(1, BAKE_MAX / Math.max(w, h));
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * k));
      c.height = Math.max(1, Math.round(h * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      try { URL.revokeObjectURL(img.src); } catch (e) {}
      // No toDataURL any more. The preview used to be a JPEG copy of this canvas
      // painted as a CSS background, which meant the thing you looked at and the
      // thing that got saved were two different images produced by two different
      // engines — see drawCrop. The preview draws from this canvas directly now,
      // which also spares an iPhone a second full-size copy of the photo.
      return c;
    }
    // The crop viewport's width is measured once, on open, and EVERY number in
    // here is expressed in terms of it — the scale, the offsets, and the size of
    // the square that gets saved. So if it ever moves and nothing notices, the
    // preview keeps filling the box you can see while the save uses the old
    // width, and the picture you get is not the one you framed.
    //
    // It does move. On a phone the layout can still be settling when this opens
    // (the photo picker sheet is animating away), and turning the phone resizes
    // it outright. So re-measure and rescale instead of carrying on with a stale
    // number. Cheap, and it makes the whole thing self-correcting.
    function syncView() {
      var nv = c.view.clientWidth;
      if (!nv || nv === CROP.vw) return;
      if (!CROP.vw) { CROP.vw = nv; return; }
      var k = nv / CROP.vw;
      CROP.base *= k; CROP.x *= k; CROP.y *= k; CROP.vw = nv;
    }

    // Keep the image covering the viewport, or it can be dragged off its own
    // frame and cropped down to a corner of empty background.
    function clamp() {
      var s = CROP.base * CROP.zoom, V = CROP.vw;
      CROP.x = Math.min(0, Math.max(V - CROP.img.width * s, CROP.x));
      CROP.y = Math.min(0, Math.max(V - CROP.img.height * s, CROP.y));
    }
    // ---- ONE function draws the crop, and everything goes through it --------
    // This is the fix for a bug that survived three attempts. The preview used
    // to be CSS — a background image, sized and positioned — and the save was a
    // canvas drawImage. Two engines, the same arithmetic, and on Carter's iPhone
    // they disagreed: the dialog framed sky above his head and cut his hands,
    // the avatar came back cutting his hair with room at the bottom. Chromium
    // agreed with itself, so nothing here could reproduce it (2026-09-21).
    //
    // So they are not two code paths any more. `dest` is the size of the square
    // being drawn into — the preview canvas in device pixels, or PIC_PX for the
    // file — and everything else is expressed in the CSS pixels the crop state
    // is already in, scaled once by the transform. The preview cannot show a
    // region the file does not have, because it is the same call.
    //
    // drawImage's FOUR-argument form: the whole image into a destination rect.
    // That is exactly what `background-size` + `background-position` did, and it
    // is deliberately NOT the nine-argument source-rectangle form, which is the
    // one WebKit has read in a space of its own more than once.
    function drawCrop(g, dest) {
      var s = CROP.base * CROP.zoom, k = dest / CROP.vw;
      g.setTransform(k, 0, 0, k, 0, 0);
      g.clearRect(0, 0, CROP.vw, CROP.vw);
      g.drawImage(CROP.img, CROP.x, CROP.y, CROP.img.width * s, CROP.img.height * s);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    function paint() {
      if (!CROP.img) return;
      syncView();
      clamp();
      // Backed at device resolution so the preview is not soft on a phone, but
      // capped: 3x of a 390px-wide viewport is already 1,170px square and an
      // iPhone does not need more canvas than that lying around.
      var dpr = Math.min(3, window.devicePixelRatio || 1);
      var dest = Math.max(1, Math.round(CROP.vw * dpr));
      if (c.img.width !== dest) { c.img.width = dest; c.img.height = dest; }
      drawCrop(c.img.getContext("2d"), dest);
    }
    function openCrop(img) {
      CROP.img = img;
      wrap.hidden = false;
      say(cropMsg, "");
      // Measured once visible, or the viewport is 0 wide and every number below
      // comes out as Infinity.
      CROP.vw = c.view.clientWidth;
      CROP.base = Math.max(CROP.vw / img.width, CROP.vw / img.height);
      // Framed rather than at the widest square it can make — see FRAME above
      // for why, and why this is not conditional on which way round the photo
      // is. Only the VERTICAL anchor below is.
      var tall = img.height > img.width;
      CROP.zoom = Math.min(3, 1 / FRAME);
      c.zoom.value = Math.round(CROP.zoom * 100);
      var s = CROP.base * CROP.zoom, sh = img.height * s;
      CROP.x = (CROP.vw - img.width * s) / 2;
      // The eyeline goes to the MIDDLE of the window, not the top of the photo
      // to the top of it: what matters is where a face lands. This replaces an
      // earlier rule that opened a tall photo 10% down from its top — right
      // idea, but at cover the window was the photo's whole width, so it framed
      // the scene rather than the person in it. clamp() inside paint() pulls
      // the offset back if the photo is not tall enough to allow this.
      CROP.y = tall ? (CROP.vw / 2 - sh * TALL_EYELINE) : (CROP.vw - sh) / 2;
      paint();
      // Once more after the browser has laid the dialog out, in case the width
      // this was all measured against was not final yet.
      if (window.requestAnimationFrame) window.requestAnimationFrame(paint);
    }

    // Turning the phone, or any other resize, while the dialog is open.
    function onResize() { if (CROP.img && !wrap.hidden) paint(); }

    function closeCrop() {
      wrap.hidden = true;
      CROP.img = null;   // the object URL was revoked in bake()
      el.file.value = "";
    }
    // Zoom about the CENTRE, so what you are looking at stays put rather than
    // sliding away as you zoom.
    function setZoom(z) {
      var was = CROP.base * CROP.zoom;
      CROP.zoom = Math.min(3, Math.max(1, z));
      var now = CROP.base * CROP.zoom, V = CROP.vw;
      CROP.x = (CROP.x - V / 2) * (now / was) + V / 2;
      CROP.y = (CROP.y - V / 2) * (now / was) + V / 2;
      c.zoom.value = Math.round(CROP.zoom * 100);
      paint();
    }

    var dragging = false, lastX = 0, lastY = 0;
    c.view.addEventListener("pointerdown", function (e) {
      if (!CROP.img) return;
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      c.view.setPointerCapture(e.pointerId);
    });
    c.view.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      CROP.x += e.clientX - lastX; CROP.y += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      paint();
    });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      c.view.addEventListener(ev, function () { dragging = false; });
    });
    c.view.addEventListener("wheel", function (e) {
      if (!CROP.img) return;
      e.preventDefault();
      setZoom(CROP.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    }, { passive: false });
    c.zoom.addEventListener("input", function () { if (CROP.img) setZoom(this.value / 100); });
    c.cancel.addEventListener("click", closeCrop);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) closeCrop(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !wrap.hidden) closeCrop();
    });

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    c.ok.addEventListener("click", function () {
      c.ok.disabled = true;
      say(cropMsg, "");
      // Against the live width, not one captured when the dialog opened: this
      // has to be the same square the preview is showing.
      syncView();
      clamp();
      var canvas = document.createElement("canvas");
      canvas.width = canvas.height = PIC_PX;
      drawCrop(canvas.getContext("2d"), PIC_PX);
      new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error("could not read that image")); },
          "image/jpeg", 0.88);
      }).then(function (blob) {
        return fetch("/api/account/avatar", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "image/jpeg" }, body: blob,
        });
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) throw new Error(d.error || ("Something went wrong (" + r.status + ")."));
          return d;
        });
      }).then(function (d) {
        me.avatar = d.avatar;
        render();
        closeCrop();
        say(msg.pic, "Picture updated.", true);
        closeSoon("pic");
        if (opts.onChange) opts.onChange(me);
      }).catch(function (e) { say(cropMsg, e.message); })
        .then(function () { c.ok.disabled = false; });
    });

    el.pick.addEventListener("click", function () { el.file.click(); });
    el.file.addEventListener("change", function () {
      var file = el.file.files && el.file.files[0];
      if (!file) return;
      say(msg.pic, "");
      el.pick.disabled = true;
      loadImage(file).then(openCrop)
        .catch(function (e) { say(msg.pic, e.message); el.file.value = ""; })
        .then(function () { el.pick.disabled = false; });
    });
    el.clear.addEventListener("click", function () {
      el.clear.disabled = true;
      post("/api/account/avatar", undefined, "DELETE").then(function () {
        me.avatar = null; render();
        say(msg.pic, "Picture removed.", true); closeSoon("pic");
        if (opts.onChange) opts.onChange(me);
      }).catch(function (e) { say(msg.pic, e.message); })
        .then(function () { el.clear.disabled = false; });
    });

    render();
    return { render: render, account: me };
  }

  global.CoasterHubProfile = { mount: mount };
})(typeof window !== "undefined" ? window : globalThis);
