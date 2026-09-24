#!/usr/bin/env node
/* Rebuild the icon rasters from the mark's geometry, so they can never drift
 * from mark.svg. Writes favicon-16.png, favicon-32.png, apple-touch-icon.png,
 * and recomposites the tile in og-image.png (only the tile — see below).
 *
 *   npm i --no-save playwright-core && node tools/render-icons.mjs
 *
 * Chromium is expected at /opt/pw-browsers (the sandbox has it pre-installed).
 * The path here must match mark.svg; see "The mark is one path" in the handoff
 * before changing any of these numbers. */
import { chromium } from "playwright-core";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..") + "/";
const exe = "/opt/pw-browsers/" + readdirSync("/opt/pw-browsers").find(d => d.startsWith("chromium-")) + "/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });

const TRACK = "M7,54 C7,30 10,14.5 17,14.5 C24,14.5 27,47 34,47 C41,47 43.86,39.08 50.22,32.72 A9.5,9.5 0 1 0 36.78,32.72 C43.85,39.79 52,54 58,54";
const CAR = '<rect x="11.5" y="8" width="12" height="6.4" rx="2.6" fill="#ffcc1f"/>'
          + '<circle cx="14.7" cy="6.7" r="1.35" fill="#eaf7ff"/><circle cx="20.3" cy="6.7" r="1.35" fill="#eaf7ff"/>';

// tile: rx as a fraction of 64 so it scales; fill overridable for the OG composite
const icon = ({ size, tile = "#1b1e22", rx = 14, w = 5.5, ground = true, car = CAR }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  ${tile ? `<rect width="64" height="64" rx="${rx}" fill="${tile}"/>` : ""}
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${ground ? '<line x1="6" y1="54" x2="58" y2="54" stroke="#4cc3ff" stroke-width="2" opacity="0.4"/>' : ""}
    <path d="${TRACK}" stroke="#4cc3ff" stroke-width="${w}"/>
    ${car}
  </g></svg>`;

async function shot(html, width, height, out) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>html,body{margin:0;padding:0;background:transparent}</style>${html}`);
  await page.screenshot({ path: ROOT + out, omitBackground: true });
  await page.close();
  console.log("wrote " + out + "  " + width + "x" + height);
}

// --- favicons + touch icon (no text, safe to re-render here) ---------------
await shot(icon({ size: 32 }), 32, 32, "favicon-32.png");
// 16px drops the ground line and the riders' heads — see favicon-small.svg
await shot(icon({ size: 16, w: 7, ground: false, car: '<rect x="11" y="7.4" width="13" height="7" rx="3" fill="#ffcc1f"/>' }),
           16, 16, "favicon-16.png");
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
       ${icon({ size: 201, tile: "#061121", rx: 14.3, w: 5.5 })}
     </div>
     <div style="position:absolute;left:0;top:396px;width:1200px;height:104px;
                 background-image:repeating-linear-gradient(to bottom,#04091a 0,#04091a 1px,#01030c 1px,#01030c 2px)"></div>
     ${tagLine(TAG1, 412, 23, 16, "#4cc3ff")}
     ${tagLine(TAG2, 455, 18, 8, "#9fb0d6")}
   </div>`,
  1200, 630, "og-image.png");

await browser.close();
