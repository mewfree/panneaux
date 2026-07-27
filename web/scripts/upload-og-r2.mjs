/**
 * Upload pre-generated OG cards (data/og/{cid}.png) to R2 as og/{cid}.
 *
 * Usage (from monorepo root or web/):
 *   node web/scripts/upload-og-r2.mjs
 *   node web/scripts/upload-og-r2.mjs --concurrency 8
 *   node web/scripts/upload-og-r2.mjs --cid 45728
 *   node web/scripts/upload-og-r2.mjs --limit 50
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const WEB = path.resolve(__dirname, "..");
const OG_DIR = path.join(ROOT, "data/og");
const BUCKET = "panneaux-images";

const args = process.argv.slice(2);
function argVal(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const concurrency = Math.max(1, Number(argVal("--concurrency") || 8));
const onlyCid = argVal("--cid");
const limit = argVal("--limit") ? Number(argVal("--limit")) : Infinity;

let files = fs
  .readdirSync(OG_DIR)
  .filter((f) => f.endsWith(".png"))
  .sort();
if (onlyCid) files = files.filter((f) => f === `${onlyCid}.png`);
files = files.slice(0, Number.isFinite(limit) ? limit : files.length);

if (files.length === 0) {
  console.error(`No OG PNGs in ${OG_DIR}`);
  process.exit(1);
}

console.log(
  `Uploading ${files.length} OG card(s) → R2 ${BUCKET}/og/{cid} (concurrency ${concurrency})`,
);

function putOne(file) {
  const cid = path.basename(file, ".png");
  const key = `og/${cid}`;
  const full = path.join(OG_DIR, file);
  return new Promise((resolve) => {
    const child = spawn(
      "pnpm",
      [
        "exec",
        "wrangler",
        "r2",
        "object",
        "put",
        `${BUCKET}/${key}`,
        `--file=${full}`,
        "--remote",
        "--content-type=image/png",
      ],
      {
        cwd: WEB,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let err = "";
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.stdout.on("data", () => {});
    child.on("close", (code) => {
      if (code === 0) resolve({ ok: true, cid });
      else resolve({ ok: false, cid, err: err.trim().slice(-300) });
    });
  });
}

let ok = 0;
let fail = 0;
const failures = [];
let next = 0;
let done = 0;

async function worker() {
  while (next < files.length) {
    const i = next++;
    const file = files[i];
    const r = await putOne(file);
    done++;
    if (r.ok) ok++;
    else {
      fail++;
      failures.push(r);
    }
    if (done % 25 === 0 || done === files.length) {
      console.log(`  ${done}/${files.length} (ok ${ok}, fail ${fail})`);
    }
  }
}

const workers = Array.from(
  { length: Math.min(concurrency, files.length) },
  () => worker(),
);
await Promise.all(workers);

console.log(`Done: ok ${ok}, fail ${fail}`);
if (failures.length) {
  console.error("Failures (first 15):");
  for (const f of failures.slice(0, 15)) {
    console.error(`  ${f.cid}: ${f.err || "unknown"}`);
  }
  process.exit(1);
}
