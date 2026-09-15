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
      +   '<p class="hint" style="margin-top:12px">Cropped square and shrunk in your browser before'
      +     ' it is sent, so a photo straight off a phone is fine.</p>'
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

      // Log a day is gone from here — it is the middle tab and a header link
      // already, and a profile is not a menu.
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
      +   '<div class="cropview" data-el="view"><div class="cropimg" data-el="img"></div>'
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
      });
    }
    // Keep the image covering the viewport, or it can be dragged off its own
    // frame and cropped down to a corner of empty background.
    function clamp() {
      var s = CROP.base * CROP.zoom, V = CROP.vw;
      CROP.x = Math.min(0, Math.max(V - CROP.img.width * s, CROP.x));
      CROP.y = Math.min(0, Math.max(V - CROP.img.height * s, CROP.y));
    }
    function paint() {
      clamp();
      var s = CROP.base * CROP.zoom;
      c.img.style.backgroundImage = 'url("' + CROP.img.src + '")';
      c.img.style.backgroundSize = (CROP.img.width * s) + "px " + (CROP.img.height * s) + "px";
      c.img.style.backgroundPosition = CROP.x + "px " + CROP.y + "px";
    }
    function openCrop(img) {
      CROP.img = img; CROP.zoom = 1;
      wrap.hidden = false;
      say(cropMsg, "");
      c.zoom.value = 100;
      // Measured once visible, or the viewport is 0 wide and every number below
      // comes out as Infinity.
      CROP.vw = c.view.clientWidth;
      CROP.base = Math.max(CROP.vw / img.width, CROP.vw / img.height);
      CROP.x = (CROP.vw - img.width * CROP.base) / 2;
      CROP.y = (CROP.vw - img.height * CROP.base) / 2;
      paint();
    }
    function closeCrop() {
      wrap.hidden = true;
      if (CROP.img) { try { URL.revokeObjectURL(CROP.img.src); } catch (e) {} }
      CROP.img = null;
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

    c.ok.addEventListener("click", function () {
      c.ok.disabled = true;
      say(cropMsg, "");
      var s = CROP.base * CROP.zoom, V = CROP.vw;
      var canvas = document.createElement("canvas");
      canvas.width = canvas.height = PIC_PX;
      canvas.getContext("2d").drawImage(CROP.img, -CROP.x / s, -CROP.y / s, V / s, V / s,
        0, 0, PIC_PX, PIC_PX);
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
