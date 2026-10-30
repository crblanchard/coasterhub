# Coaster Hub app

The iPhone (and later Android) app: a [Capacitor](https://capacitorjs.com) 8
shell that opens **https://coasterhub.org** (`capacitor.config.json`
`server.url`). The app IS the site, so every push to `main` reaches the app
with no store update. A store update is only needed when something in this
folder changes (icon, permissions, plugins) — about once a year.

- `www/` — what ships inside the app. `offline.html` is NOT wired up any
  more: Capacitor's `server.errorPath` showed it for any failed navigation,
  including one simply cancelled by tapping the next link, so "No signal"
  popped up mid-browse (Carter, 2026-10-30). No signal is the site's service
  worker's job (sw.js); it needs one successful launch first. iOS allows a
  service worker in a web view only for "app-bound domains", hence
  `WKAppBoundDomains` in `ios/App/App/Info.plist` and
  `limitsNavigationsToAppBoundDomains`.
- `ios/` — the Xcode project, from `npx cap add ios`. iPhone only, portrait
  only. Icon and launch screen: `node tools/render-app-icons.mjs`.
- The site knows it is in the app through `CoasterHub.inApp()` (app.js): the
  status bar follows light/dark natively, and links off coasterhub.org open
  in an in-app browser sheet. `<html class="inapp">` is there for CSS.

No Mac needed: `.github/workflows/ios.yml` builds it on GitHub's Macs, and
uploads to TestFlight when run by hand with "Send to TestFlight" ticked. The
secrets it needs are listed at the top of that file.

After changing `capacitor.config.json` or adding a plugin:

    cd app && npm install && npx cap sync ios
