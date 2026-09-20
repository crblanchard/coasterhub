#!/usr/bin/env node
/* Console-safe SQL out of a migration file.
 *
 *   node tools/paste-sql.mjs migrations/017-model-triage.sql
 *   node tools/paste-sql.mjs migrations/018-merge-orphans.sql --one-line
 *
 * Why this exists: the D1 console's query box is a SINGLE LINE. Paste a
 * migration into it and every newline goes away — at which point the first
 * `--` comment swallows the whole file and D1 answers "The request is
 * malformed: Requests without any query are not supported." The file is fine;
 * the paste is not. (2026-09-20, pasting 017.)
 *
 * So this prints the statements with the comments stripped: one statement per
 * line by default, which is what you want when the console takes them one at a
 * time, and --one-line joins them for a console that takes several.
 *
 * The migration FILES keep their comments. They are the explanation of why a
 * change was made and they are worth more than the convenience of pasting.
 *
 * One caveat, deliberately not solved: this strips `--` to end of line without
 * knowing about string literals, so a migration with `--` INSIDE a quoted
 * string would come out wrong. None do, and if one ever does, this will need to
 * learn about quotes rather than be worked around.
 */
import { readFileSync } from "node:fs";

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("usage: node tools/paste-sql.mjs migrations/<file>.sql [--one-line]");
  process.exit(2);
}

const stripped = readFileSync(file, "utf8")
  .split("\n")
  .map((l) => l.replace(/--.*$/, ""))
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

// Split on the semicolons, then put one back on each statement: a console that
// takes them one at a time still wants the terminator.
const statements = stripped
  .split(";")
  .map((s) => s.replace(/\s+/g, " ").trim())
  .filter(Boolean)
  .map((s) => s + ";");

if (!statements.length) {
  console.error("nothing but comments in " + file);
  process.exit(1);
}
console.log(statements.join(flags.includes("--one-line") ? " " : "\n"));
