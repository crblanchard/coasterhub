#!/usr/bin/env node
/* The app's icon and launch screen (2026-10-30), drawn from the same pin as
 * tools/render-icons.mjs — keep PIN/BODY in step with it and mark.svg.
 *
 *   node tools/render-app-icons.mjs     (needs python3 + Pillow to flatten)
 *
 * Apple rejects an app icon with an alpha channel, so the PNGs are flattened
 * to RGB after Chromium draws them. iOS rounds the corners itself: the icon
 * is square edge to edge. */
import { chromium } from "playwright-core";
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..") + "/";
const IOS = ROOT + "app/ios/App/App/Assets.xcassets/";
const exe = "/opt/pw-browsers/chromium";  // the sandbox's pre-installed Chromium
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });

const PIN = "M32,61 C32,61 12,41 12,25 A20,20 0 1 1 52,25 C52,41 32,61 32,61 Z";
const BODY = `<path d="${PIN}" fill="#4cc3ff" stroke="#4cc3ff" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="32" cy="25" r="13" fill="#111315"/>
  <path d="M22,31 C25,31 26.5,23.5 30,23.5 C33.5,23.5 35,31 38,31 C39.5,31 40.5,29.5 41.5,28.5" fill="none" stroke="#4cc3ff" stroke-width="2.8" stroke-linecap="round"/>
  <rect x="25" y="16.5" width="10" height="5" rx="2" fill="#ffcc1f"/>`;

async function shot(html, size, out) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>html,body{margin:0;padding:0}</style>${html}`);
  await page.screenshot({ path: out });
  await page.close();
  execFileSync("python3", ["-c", "import sys;from PIL import Image;Image.open(sys.argv[1]).convert('RGB').save(sys.argv[1])", out]);
  console.log("wrote " + out.replace(ROOT, ""));
}

// Icon: the site's tile colour, the pin a little smaller than the favicon's so
// it clears the rounded corners iOS cuts.
await shot(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="1024" height="1024">
  <rect width="64" height="64" fill="#1b1e22"/><g transform="translate(32 32.5) scale(.82) translate(-32 -32)">${BODY}</g></svg>`,
  1024, IOS + "AppIcon.appiconset/AppIcon-512@2x.png");

// Launch screen: the pin, small, on the dark page colour the site opens on.
for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await shot(`<div style="width:2732px;height:2732px;background:#080e20;display:flex;align-items:center;justify-content:center">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="300" height="300">${BODY}</svg></div>`,
    2732, IOS + "Splash.imageset/" + f);
}
await browser.close();
