#!/usr/bin/env node
/* The avatar crop, end to end, against a REAL EXIF-rotated JPEG.
 *
 *   node tools/dev-server.mjs &                 # serves the site + the worker
 *   npm i --no-save playwright-core
 *   node tools/test-crop.mjs [http://127.0.0.1:8099]
 *
 * WHY THIS EXISTS. The handoff has long said this class of bug is invisible to a
 * test, because a synthetic PNG carries no EXIF and the whole failure is about
 * EXIF. That was true only because nobody wrote the fixture. A JPEG with an
 * Orientation tag is 36 bytes of header in front of an ordinary one, so this
 * file builds its own: the bitmap is stored LANDSCAPE and tagged "rotate 90",
 * which is exactly what a phone hands over, and no binary is committed.
 *
 * Every pixel of the fixture says where it is — RED is the row as a fraction of
 * the displayed height, GREEN the column as a fraction of its width. So both the
 * preview and the saved file can be read back as "this is 6%-58% down and
 * 15%-85% across the photo" and compared to each other DIRECTLY, in the same
 * units, sampled at the same points. That comparison is the whole point, and it
 * is read off pixels rather than CSS on purpose: the two used to be a CSS
 * background and a canvas draw, two engines for one piece of arithmetic, and
 * when they disagreed the picture you got was not the one you framed.
 *
 * What it asserts:
 *   1. the browser applies the EXIF rotation (600x800 out of an 800x600 bitmap)
 *   2. the saved file IS the previewed region, within JPEG noise
 *   3. a tall photo opens framed on the upper middle, not at its full width
 *   4. a WIDE photo is framed too, and centred. It used to be left at cover on
 *      the reasoning that a landscape square is already tight; it isn't, it is
 *      merely less loose, and that is the bug this test was extended to catch.
 *
 * JPEG is lossy, so the read-back is compared to within TOL. At 800px tall, 0.02
 * is about 16 rows — far tighter than any framing bug worth catching.
 */
import { chromium } from "playwright-core";
import { readdirSync } from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:8099";
const TOL = 0.02;
const CHROME = "/opt/pw-browsers/" +
  readdirSync("/opt/pw-browsers").find(d => d.startsWith("chromium-")) + "/chrome-linux/chrome";

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); }
};
const near = (a, b) => Math.abs(a - b) <= TOL;
const r3 = n => Math.round(n * 1000) / 1000;

// A JPEG whose pixels encode their own position, stored rotated with an EXIF
// Orientation tag. `rot` 6 means "rotate 90 clockwise to display", the tag a
// phone held upright writes; 1 means "as stored", for the landscape case.
async function fixture(page, w, h, rot) {
  const b64 = await page.evaluate(async ([W, H, rot]) => {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    const im = x.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let px = 0; px < W; px++) {
      const i = (y * W + px) * 4;
      im.data[i] = Math.round(255 * y / (H - 1));      // row    -> red
      im.data[i + 1] = Math.round(255 * px / (W - 1)); // column -> green
      im.data[i + 2] = 128; im.data[i + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    if (rot !== 6) return c.toDataURL("image/jpeg", 0.95).split(",")[1];
    // Store it rotated 90 ANTI-clockwise, so applying the tag recovers it.
    const r = document.createElement("canvas"); r.width = H; r.height = W;
    const rx = r.getContext("2d");
    rx.translate(0, W); rx.rotate(-Math.PI / 2); rx.drawImage(c, 0, 0);
    return r.toDataURL("image/jpeg", 0.95).split(",")[1];
  }, [w, h, rot]);

  const jpeg = Buffer.from(b64, "base64");
  if (rot !== 6) return jpeg;
  // APP1: "Exif\0\0", then a big-endian TIFF header and one IFD entry —
  // tag 0x0112 (Orientation), type 3 (SHORT), count 1, value 6.
  const tiff = Buffer.concat([
    Buffer.from("MM", "ascii"),
    u16(42), u32(8), u16(1),
    u16(0x0112), u16(3), u32(1), u16(6), u16(0),
    u32(0),
  ]);
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), u16(payload.length + 2), payload]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };

async function run(page, label, w, h, rot, expect, drag) {
  console.log("\n" + label);
  const buf = await fixture(page, w, h, rot);
  await page.goto(BASE + "/account");
  await page.waitForSelector(".profedit", { timeout: 20000 });

  const natural = await page.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode();
    return img.naturalWidth + "x" + img.naturalHeight;
  }, "data:image/jpeg;base64," + buf.toString("base64"));
  check("the browser applies the EXIF rotation", natural === w + "x" + h, natural);

  const input = (await page.$$("input[type=file]"))[0];
  await input.setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: buf });
  await page.waitForSelector(".cropwrap:not([hidden])", { timeout: 20000 });
  await page.waitForTimeout(400);   // the second paint(), after layout settles

  // Dragging is where a preview and a save that were two code paths would drift
  // apart the furthest, so one case does it: the default frame proves the
  // opening arithmetic, this proves the arithmetic it is nudged to.
  if (drag) {
    const box = await (await page.$(".cropview")).boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + drag.dx, cy + drag.dy, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  }

  // What the dialog is SHOWING, read out of the preview canvas's own pixels.
  // Sampled 2% inside the edges, the same insets the saved file is read at
  // below, so the two sets of numbers are directly comparable.
  const shown = await page.evaluate(() => {
    const cv = document.querySelector("canvas.cropimg");
    if (!cv || !cv.width) return { error: "the preview is not a canvas with a bitmap" };
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    const at = (fx, fy) => {
      const i = (Math.round((cv.height - 1) * fy) * cv.width + Math.round((cv.width - 1) * fx)) * 4;
      return { row: d[i] / 255, col: d[i + 1] / 255 };
    };
    const a = at(0.02, 0.02), b = at(0.98, 0.98);
    return { top: a.row, left: a.col, bottom: b.row, right: b.col };
  });
  if (shown.error) { check("the preview drew", false, shown.error); return; }
  console.log("       preview: " + JSON.stringify({ top: r3(shown.top), bottom: r3(shown.bottom),
                                                    left: r3(shown.left), right: r3(shown.right) }));
  if (expect) {
    check("opens where it should", near(shown.top, expect.top) && near(shown.left, expect.left),
      "top " + r3(shown.top) + " want " + expect.top + ", left " + r3(shown.left) + " want " + expect.left);
  } else {
    // A drag has to actually have moved the frame, or the next check passes for
    // the wrong reason. Measured against where the same photo OPENS (0.069,
    // 0.164), in either direction: dragging the picture down moves the window
    // UP the photo, which is the sign this guard first got wrong.
    check("the drag moved the frame",
      Math.abs(shown.top - 0.069) > 0.03 || Math.abs(shown.left - 0.164) > 0.03,
      "top " + r3(shown.top) + " and left " + r3(shown.left) + " are where it opens");
  }

  await page.click(".cropbox button.primary");
  // A failure shows up in the dialog's own message line, so wait for EITHER
  // outcome and report what it said — a bare timeout here tells you nothing.
  await page.waitForFunction(() => document.querySelector(".cropwrap").hidden
    || (document.querySelector('[data-msg="crop"]').textContent || "").trim().length > 0,
    null, { timeout: 20000 });
  const said = (await page.textContent('[data-msg="crop"]') || "").trim();
  if (said) { check("saving succeeded", false, said); return; }
  await page.waitForTimeout(500);

  // ...and what actually went up, read back out of its own pixels.
  const saved = await page.evaluate(async () => {
    const el = document.querySelector(".profedit .av");
    const m = /url\("?([^")]+)"?\)/.exec(getComputedStyle(el).backgroundImage || "");
    if (!m) return { error: "no avatar on the page after saving" };
    const img = new Image(); img.src = m[1]; await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const at = (fx, fy) => {
      const i = (Math.round((c.height - 1) * fy) * c.width + Math.round((c.width - 1) * fx)) * 4;
      return { row: d[i] / 255, col: d[i + 1] / 255 };
    };
    // Sampled 2% inside the edges, not on them: a JPEG's outermost pixels carry
    // the most ringing, and an edge sample is the one that fails for no reason.
    const a = at(0.02, 0.02), b = at(0.98, 0.98);
    return { size: img.naturalWidth + "x" + img.naturalHeight,
             top: a.row, left: a.col, bottom: b.row, right: b.col };
  });
  if (saved.error) { check("the file saved", false, saved.error); return; }
  check("saved 256x256", saved.size === "256x256", saved.size);

  // The file is one thing; what the page DRAWS from it is another, and the
  // latter is what anybody actually compares to the dialog. Screenshot the
  // avatar element as rendered — border, background-size, border-radius and
  // all — and read its pixels at the same insets. The circle clip makes the
  // corners transparent, so sample just inside the circle on the vertical and
  // horizontal centre lines instead of at the corners.
  const avPng = await (await page.$(".profedit .av")).screenshot({ omitBackground: true });
  const drawn = await page.evaluate(async b64 => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const at = (fx, fy) => {
      const i = (Math.round((c.height - 1) * fy) * c.width + Math.round((c.width - 1) * fx)) * 4;
      return { row: d[i] / 255, col: d[i + 1] / 255, a: d[i + 3] };
    };
    // 4% in, not 2%: the element has a 1px border and the circle's edge is
    // anti-aliased, so the outermost ring is not the image.
    return { size: c.width + "x" + c.height,
             top: at(0.5, 0.04), bottom: at(0.5, 0.96), left: at(0.04, 0.5), right: at(0.96, 0.5) };
  }, avPng.toString("base64"));
  console.log("       drawn:   " + JSON.stringify({ top: r3(drawn.top.row), bottom: r3(drawn.bottom.row),
                                                    left: r3(drawn.left.col), right: r3(drawn.right.col),
                                                    el: drawn.size }));
  // Expected: the preview's window, 4% in along the centre lines.
  const pv = { v: shown.bottom - shown.top, h: shown.right - shown.left };
  // shown.* were sampled 2% in, so the true window edges are those pulled back out.
  const winTop = shown.top - 0.02 / 0.96 * pv.v, winLeft = shown.left - 0.02 / 0.96 * pv.h;
  const winV = pv.v / 0.96, winH = pv.h / 0.96;
  check("the page draws the avatar as the preview showed it",
    drawn.top.a > 200 && drawn.bottom.a > 200
    && near(drawn.top.row, winTop + 0.04 * winV) && near(drawn.bottom.row, winTop + 0.96 * winV)
    && near(drawn.left.col, winLeft + 0.04 * winH) && near(drawn.right.col, winLeft + 0.96 * winH),
    JSON.stringify({ drawn: { top: r3(drawn.top.row), bottom: r3(drawn.bottom.row),
                              left: r3(drawn.left.col), right: r3(drawn.right.col) },
                     wanted: { top: r3(winTop + 0.04 * winV), bottom: r3(winTop + 0.96 * winV),
                               left: r3(winLeft + 0.04 * winH), right: r3(winLeft + 0.96 * winH) } }));
  console.log("       saved:   " + JSON.stringify({ top: r3(saved.top), bottom: r3(saved.bottom),
                                                    left: r3(saved.left), right: r3(saved.right) }));
  // Both were sampled at the same insets of their own square, so the SAME
  // numbers have to come back. This is the assertion the whole file exists for.
  check("the saved file shows exactly what the preview showed",
    near(saved.top, shown.top) && near(saved.bottom, shown.bottom)
    && near(saved.left, shown.left) && near(saved.right, shown.right),
    JSON.stringify({ preview: { top: r3(shown.top), bottom: r3(shown.bottom),
                                left: r3(shown.left), right: r3(shown.right) },
                     saved: { top: r3(saved.top), bottom: r3(saved.bottom),
                              left: r3(saved.left), right: r3(saved.right) } }));
}

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
await page.setContent("<div></div>");   // somewhere to build the fixtures
try {
  // A phone photo held upright: 600x800 displayed, 800x600 stored, tagged 6.
  // TALL_FRAME 0.70 and TALL_EYELINE 0.32 put the window at 15%-85% across and
  // centre it 32% down, which on a 600x800 is 5.8% to 58.3%.
  await run(page, "A portrait photo with EXIF Orientation=6", 600, 800, 6,
    { top: 0.069, left: 0.164 });   // window 5.8%-58.3% and 15%-85%, sampled 2% in
  // The same photo, dragged down and left before saving. `expect` is skipped
  // here — where a drag lands depends on the viewport this runs at, and the
  // assertion that matters is the next one: preview and file still agree.
  await run(page, "A portrait photo, dragged before saving", 600, 800, 6,
    null, { dx: -30, dy: 45 });
  // A wide photo: FRAME 0.70 of the short edge (the height) is a 420px square on
  // an 800x600, centred both ways — 15%-85% down, 23.75%-76.25% across.
  await run(page, "A landscape photo, no rotation", 800, 600, 1,
    { top: 0.164, left: 0.248 });   // window 15%-85% and 23.75%-76.25%, sampled 2% in
  // The size a phone actually hands over: 12 megapixels, stored 4032x3024 and
  // tagged to display 3024x4032. The small fixtures above never make bake()
  // scale anything (BAKE_MAX is 1800); this one makes it scale by 0.446, which
  // is the path a real upload takes and the small ones do not.
  await run(page, "A 12-megapixel phone photo, EXIF Orientation=6", 3024, 4032, 6,
    { top: 0.069, left: 0.164 });
  // Square, as a photo already cropped in the Photos app arrives. Not tall, so
  // it opens centred both ways: 15%-85% each way.
  await run(page, "A square photo", 1200, 1200, 1,
    { top: 0.164, left: 0.164 });
} finally {
  await browser.close();
}
console.log("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
