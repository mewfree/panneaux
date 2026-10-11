/**
 * Génère des images Open Graph 1200×630 brandées avec le panneau.
 *
 * Prérequis : ImageMagick (`magick`), images dans data/images/{cid}.png
 *
 * Usage (racine monorepo) :
 *   node web/scripts/generate-og-images.mjs
 *   node web/scripts/generate-og-images.mjs --concurrency 4
 *   node web/scripts/generate-og-images.mjs --limit 20
 *   node web/scripts/generate-og-images.mjs --cid 12451
 *
 * Sortie : data/og/{cid}.png  →  uploader vers R2 sous la clé « og/{cid} »
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const CATALOG = path.join(ROOT, "data/panneaux.json");
const IMAGES = path.join(ROOT, "data/images");
const OUT_DIR = path.join(ROOT, "data/og");

const args = process.argv.slice(2);
function argVal(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const limit = argVal("--limit") ? Number(argVal("--limit")) : Infinity;
const onlyCid = argVal("--cid") ? Number(argVal("--cid")) : null;
const force = args.includes("--force");
const concurrency = Math.max(
  1,
  Number(argVal("--concurrency") || Math.min(8, os.availableParallelism())),
);

const FONT_BOLD = [
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
].find((f) => fs.existsSync(f));

const FONT_REG = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/TTF/DejaVuSans.ttf",
].find((f) => fs.existsSync(f));

if (!FONT_BOLD || !FONT_REG) {
  console.error("Polices Arial/DejaVu introuvables. Installez des polices TTF.");
  process.exit(1);
}

function findSourceImage(cid) {
  for (const ext of ["png", "jpg", "jpeg", "webp", "gif"]) {
    const p = path.join(IMAGES, `${cid}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Escape special chars for ImageMagick -annotate (no length truncate). */
function escapeAnnotate(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "%%");
}

/** Collapse whitespace, truncate with an ellipsis, then escape for annotate. */
function safeAnnotate(text, max = 42) {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length > max) t = t.slice(0, max - 1) + "…";
  return escapeAnnotate(t);
}

function wrapLines(text, maxLen = 36, maxLines = 3) {
  const full = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  const words = full.split(" ").filter(Boolean);
  const lines = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxLen && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) {
        // Remaining words (including w) do not fit — ellipsis on last line
        const last = lines.length - 1;
        let t = lines[last].trimEnd();
        if (t.length > maxLen - 1) t = t.slice(0, maxLen - 1).trimEnd();
        lines[last] = `${t}…`;
        cur = "";
        break;
      }
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // Single overlong word
  if (lines.length === 0 && full) {
    lines.push(full.length > maxLen ? `${full.slice(0, maxLen - 1)}…` : full);
  }
  return lines.map((l) => escapeAnnotate(l));
}

async function generateOne(cid, code, nameFr) {
  const src = findSourceImage(cid);
  if (!src) return { ok: false, reason: "no source image" };

  const dest = path.join(OUT_DIR, `${cid}.png`);
  if (!force && fs.existsSync(dest)) {
    return { ok: true, skipped: true };
  }

  // Layout: brand → title (name) large → code (id) below → footer
  // Text column ~x=620; ~520px wide — wrap tightly for large type.
  const titleLines = wrapLines(nameFr, 22, 4);
  const codeText = safeAnnotate(code, 32);
  const textX = 620;

  // Build magick args: background + panneau + texts
  const magickArgs = [
    "-size",
    "1200x630",
    `xc:#0f172a`,
    "(",
    src,
    "-resize",
    "500x500>",
    "-background",
    "none",
    "-gravity",
    "center",
    "-extent",
    "560x560",
    ")",
    "-gravity",
    "west",
    "-geometry",
    "+32+0",
    "-composite",
    // Brand
    "-fill",
    "#64748b",
    "-font",
    FONT_REG,
    "-pointsize",
    "26",
    "-gravity",
    "northwest",
    "-annotate",
    `+${textX}+100`,
    "Panneaux QC",
  ];

  // Title (name) — primary, large bold
  let y = 155;
  const titleLineH = 50;
  for (const line of titleLines) {
    magickArgs.push(
      "-fill",
      "#f8fafc",
      "-font",
      FONT_BOLD,
      "-pointsize",
      "42",
      "-annotate",
      `+${textX}+${y}`,
      line,
    );
    y += titleLineH;
  }

  // Code / id — secondary, under title
  y += 10;
  magickArgs.push(
    "-fill",
    "#94a3b8",
    "-font",
    FONT_REG,
    "-pointsize",
    "30",
    "-annotate",
    `+${textX}+${y}`,
    codeText,
  );

  magickArgs.push(
    "-fill",
    "#475569",
    "-font",
    FONT_REG,
    "-pointsize",
    "22",
    "-annotate",
    `+${textX}+540`,
    "Signalisation routiere du Quebec",
    dest,
  );

  try {
    await execFileAsync("magick", magickArgs);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.stderr?.toString?.() || err.message || String(err) };
  }
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
let list = catalog.panneaux ?? [];
if (onlyCid != null) list = list.filter((p) => p.cid === onlyCid);
list = list.slice(0, Number.isFinite(limit) ? limit : list.length);

fs.mkdirSync(OUT_DIR, { recursive: true });

let ok = 0;
let skip = 0;
let fail = 0;
let done = 0;
let next = 0;

console.log(`OG: ${list.length} panneaux → ${OUT_DIR} (concurrency ${concurrency})`);

async function worker() {
  while (next < list.length) {
    const p = list[next++];
    const r = await generateOne(p.cid, p.code, p.nameFr);
    if (r.ok && r.skipped) skip++;
    else if (r.ok) ok++;
    else {
      fail++;
      if (fail <= 10) console.warn(`  fail ${p.cid}: ${r.reason}`);
    }
    done++;
    if (done % 100 === 0 || done === list.length) {
      console.log(`  ${done}/${list.length} (ok ${ok}, skip ${skip}, fail ${fail})`);
    }
  }
}

await Promise.all(
  Array.from({ length: Math.min(concurrency, list.length) }, () => worker()),
);

console.log(`Terminé: générés ${ok}, déjà présents ${skip}, échecs ${fail}`);
console.log(`Upload R2 exemple:`);
console.log(
  `  for f in data/og/*; do key="og/$(basename "\${f%.*}")"; npx wrangler r2 object put "panneaux-images/\${key}" --file="\$f" --remote; done`,
);
