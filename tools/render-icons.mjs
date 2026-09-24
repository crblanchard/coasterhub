#!/usr/bin/env node
/* Rebuild the icon rasters from the mark's geometry, so they can never drift
 * from mark.svg. Writes favicon-16.png, favicon-32.png, apple-touch-icon.png,
 * and recomposites the tile in og-image.png (only the tile — see below).
 *
 *   npm i --no-save playwright-core && node tools/render-icons.mjs
 *
 * Chromium is expected at /opt/pw-browsers (the sandbox has it pre-installed).
 * The drawing here must match mark.svg (the Solid pin, 2026-09-24). */
import { chromium } from "playwright-core";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..") + "/";
const exe = "/opt/pw-browsers/" + readdirSync("/opt/pw-browsers").find(d => d.startsWith("chromium-")) + "/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });

// The Solid pin (2026-09-24) — must match mark.svg.
const PIN = "M32,61 C32,61 12,41 12,25 A20,20 0 1 1 52,25 C52,41 32,61 32,61 Z";
const BODY = `<path d="${PIN}" fill="#4cc3ff" stroke="#4cc3ff" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="32" cy="25" r="13" fill="#111315"/>
  <path d="M22,31 C25,31 26.5,23.5 30,23.5 C33.5,23.5 35,31 38,31 C39.5,31 40.5,29.5 41.5,28.5" fill="none" stroke="#4cc3ff" stroke-width="2.8" stroke-linecap="round"/>
  <rect x="25" y="16.5" width="10" height="5" rx="2" fill="#ffcc1f"/>`;
// 16px: no hill, a smaller window and a bigger car — see favicon-small.svg.
const SMALL = `<path d="${PIN}" fill="#4cc3ff" stroke="#4cc3ff" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="32" cy="25" r="11" fill="#111315"/>
  <rect x="25" y="21" width="14" height="7.5" rx="3" fill="#ffcc1f"/>`;

// tile: rx as a fraction of 64 so it scales; fill overridable for the OG composite
const icon = ({ size, tile = "#1b1e22", rx = 14, small = false }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  ${tile ? `<rect width="64" height="64" rx="${rx}" fill="${tile}"/>` : ""}
  <g>${small ? SMALL : BODY}</g></svg>`;

async function shot(html, width, height, out) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>html,body{margin:0;padding:0;background:transparent}</style>${html}`);
  await page.screenshot({ path: ROOT + out, omitBackground: true });
  await page.close();
  console.log("wrote " + out + "  " + width + "x" + height);
}

// --- favicons + touch icon (no text, safe to re-render here) ---------------
await shot(icon({ size: 32 }), 32, 32, "favicon-32.png");
// 16px drops the hill in the window — see favicon-small.svg
await shot(icon({ size: 16, small: true }), 16, 16, "favicon-16.png");
// iOS rounds the corners itself, so this one stays square edge-to-edge
await shot(icon({ size: 180, rx: 0 }), 180, 180, "apple-touch-icon.png");

// --- og-image: composite ---------------------------------------------------
// The card is redrawn ON TOP OF ITSELF: the tile, and the tagline under the
// wordmark. Everything else is left as the pixels it already is, because the
// WORDMARK was set in a font this container doesn't have and re-rendering it
// would change the type. The tagline can be redrawn — it is small, uppercase
// and spaced out to 30px per character, which is a rhythm any grotesque hits.
//
// Measured off the card as it was:
//   tile      201x201 at (500,92), fill #061121, radius 45 (= 14.3/64, the
//             same proportion as the favicon)
//   tagline   caps 414-429, 1,022px wide across 34 characters
//   backdrop  #04091a, with every ODD row #01030c — a scanline, over the whole
//             card and UNDER the type (the wordmark's pixels are 255,255,255
//             on both parities). Paint the patch flat and a band appears where
//             the stripes stop, so the patch repeats them, and starts on an
//             even row so they land in phase.
//
// Carter's copy, 2026-09-20. It was "A ROLLER COASTER COUNT, VISUALIZED", which
// described the site rather than saying what you do with it. Two lines now: what
// it is for, and then the three things it does.
const TAG1 = "TRACK YOUR COASTER COUNT.";
const TAG2 = "RANK YOUR CREDITS. LOG YOUR RIDES.";
// letter-spacing adds its gap AFTER the last letter too, which pushes a centred
// line half a gap to the right. The negative margin takes that back.
const tagLine = (text, top, size, ls, color) =>
  `<div style="position:absolute;left:0;top:${top}px;width:1200px;text-align:center;
               line-height:1;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;
               font-weight:700;font-size:${size}px;letter-spacing:${ls}px;color:${color}">
     <span style="display:inline-block;margin-right:-${ls}px">${text}</span>
   </div>`;
const og = "data:image/png;base64," + readFileSync(ROOT + "og-image.png").toString("base64");
await shot(
  `<div style="position:relative;width:1200px;height:630px">
     <img src="${og}" width="1200" height="630" style="display:block">
     <div style="position:absolute;left:500px;top:92px;width:201px;height:201px">
       ${icon({ size: 201, tile: "#061121", rx: 14.3 })}
     </div>
     <div style="position:absolute;left:0;top:396px;width:1200px;height:104px;
                 background-image:repeating-linear-gradient(to bottom,#04091a 0,#04091a 1px,#01030c 1px,#01030c 2px)"></div>
     ${tagLine(TAG1, 412, 23, 16, "#4cc3ff")}
     ${tagLine(TAG2, 455, 18, 8, "#9fb0d6")}
   </div>`,
  1200, 630, "og-image.png");

await browser.close();
