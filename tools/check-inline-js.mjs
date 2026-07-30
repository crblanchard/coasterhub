#!/usr/bin/env node
/* Parse the inline <script> block in every HTML page.
 *
 * `node --check` only covers .js files, so a syntax error inside a page's
 * <script> shipped silently — and a dead inline script is catastrophic here,
 * because it takes the nav, the tab bar and every button with it. This exact
 * bug went live on /log and /add: an edit dropped the `+` from a string
 * concatenation, leaving two adjacent literals.
 *
 *   node tools/check-inline-js.mjs
 *
 * Exits non-zero on the first failure. Run it before pushing, alongside
 * tools/test-rides-api.mjs.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Inline blocks only — <script src=...> files are covered by `node --check`.
const BLOCK = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

let files = 0, blocks = 0, bad = 0;

for (const f of (await readdir(ROOT)).filter(f => f.endsWith(".html")).sort()) {
  const html = await readFile(join(ROOT, f), "utf8");
  files++;
  let m, i = 0;
  while ((m = BLOCK.exec(html)) !== null) {
    const src = m[1];
    if (!src.trim()) continue;
    i++; blocks++;
    // Line number of the block's opening tag, so the error is findable.
    const line = html.slice(0, m.index).split("\n").length;
    try {
      // Function() parses without executing. Wrapped so a bare `return` in a
      // page-level script isn't reported as an error.
      new Function(src);
      console.log(`  ok   ${f} block ${i} (line ${line})`);
    } catch (e) {
      bad++;
      console.log(`  FAIL ${f} block ${i} (line ${line}): ${e.message}`);
    }
  }
}

console.log(`\n${blocks} inline block${blocks === 1 ? "" : "s"} across ${files} pages — ${bad} failing\n`);
process.exit(bad ? 1 : 0);
