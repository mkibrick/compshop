/**
 * Load every report directory whose path matches a glob.
 *
 * Usage:
 *   npm run db:add-report-batch "scripts/data/mercer-*"
 *
 * Each directory must contain a meta.json. XLSX files are optional (stubs allowed).
 */

import { existsSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

function expandGlob(pattern: string): string[] {
  // Handle literal paths too
  if (existsSync(pattern) && statSync(pattern).isDirectory()) {
    return [resolve(pattern)];
  }
  // Simple *-glob: resolve parent dir + prefix
  const parent = dirname(pattern);
  const base = pattern.slice(parent.length + 1);
  const resolvedParent = resolve(parent);
  if (!existsSync(resolvedParent)) return [];
  const regex = new RegExp("^" + base.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
  return readdirSync(resolvedParent)
    .filter((d) => regex.test(d))
    .map((d) => join(resolvedParent, d))
    .filter((p) => statSync(p).isDirectory() && existsSync(join(p, "meta.json")));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npm run db:add-report-batch <pattern> [<pattern>...]");
    process.exit(1);
  }
  const dirs = args.flatMap(expandGlob);
  if (dirs.length === 0) {
    console.error("No report directories found for the provided pattern(s).");
    process.exit(1);
  }
  console.log(`Loading ${dirs.length} report(s)...\n`);

  const loaderPath = resolve(__dirname, "add-report.ts");
  let ok = 0;
  let fail = 0;
  for (const d of dirs) {
    console.log(`\n── ${d}`);
    const res = spawnSync("npx", ["tsx", loaderPath, d], {
      stdio: "inherit",
      env: process.env,
    });
    if (res.status === 0) ok++;
    else fail++;
  }
  console.log(`\nBatch complete. ${ok} succeeded, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
