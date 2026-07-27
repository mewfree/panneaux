/**
 * Génère des images Open Graph 1200×630 brandées avec le panneau.
 *
 * Prérequis : ImageMagick (`magick`), images dans data/images/{cid}.png
 *
 * Usage (racine monorepo) :
 *   node web/scripts/generate-og-images.mjs
 *   node web/scripts/generate-og-images.mjs --limit 20
 *   node web/scripts/generate-og-images.mjs --cid 12451
 *
 * Sortie : data/og/{cid}.png  →  uploader vers R2 sous la clé « og/{cid} »
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

/** Truncate for annotate; escape IM special chars. */
function safeAnnotate(text, max = 42) {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length > max) t = t.slice(0, max - 1) + "…";
  // ImageMagick annotate: escape \ and %
  return t.replace(/\\/g, "\\\\").replace(/%/g, "%%");
}

function wrapLines(text, maxLen = 36, maxLines = 3) {
  const words = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxLen && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    } else {
      cur = next;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = safeAnnotate(lines[maxLines - 1], maxLen);
  }
  return lines.map((l) => safeAnnotate(l, maxLen + 2));
}

function generateOne(cid, code, nameFr) {
  const src = findSourceImage(cid);
  if (!src) return { ok: false, reason: "no source image" };

  const dest = path.join(OUT_DIR, `${cid}.png`);
  if (!force && fs.existsSync(dest)) {
    return { ok: true, skipped: true };
  }

  const codeText = safeAnnotate(code, 28);
  const nameLines = wrapLines(nameFr, 34, 3);

  // Build magick args: background + panneau + texts
  const args = [
    "-size",
    "1200x630",
    `xc:#0f172a`,
    "(",
    src,
    "-resize",
    "420x420>",
    "-background",
    "none",
    "-gravity",
    "center",
    "-extent",
    "500x500",
    ")",
    "-gravity",
    "west",
    "-geometry",
    "+50+0",
    "-composite",
    "-fill",
    "#64748b",
    "-font",
    FONT_REG,
    "-pointsize",
    "22",
    "-gravity",
    "northwest",
    "-annotate",
    "+580+140",
    "Panneaux QC",
    "-fill",
    "#f8fafc",
    "-font",
    FONT_BOLD,
    "-pointsize",
    "48",
    "-annotate",
    "+580+200",
    codeText,
  ];

  let y = 270;
  for (const line of nameLines) {
    args.push(
      "-fill",
      "#94a3b8",
      "-font",
      FONT_REG,
      "-pointsize",
      "28",
      "-annotate",
      `+580+${y}`,
      line,
    );
    y += 40;
  }

  args.push(
    "-fill",
    "#475569",
    "-font",
    FONT_REG,
    "-pointsize",
    "20",
    "-annotate",
    "+580+540",
    "Signalisation routiere du Quebec",
    dest,
  );

  try {
    execFileSync("magick", args, { stdio: "pipe" });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err.stderr?.toString?.() || err.message || String(err),
    };
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

console.log(`OG: ${list.length} panneaux → ${OUT_DIR}`);

for (const [i, p] of list.entries()) {
  const r = generateOne(p.cid, p.code, p.nameFr);
  if (r.ok && r.skipped) skip++;
  else if (r.ok) ok++;
  else {
    fail++;
    if (fail <= 10) console.warn(`  fail ${p.cid}: ${r.reason}`);
  }
  if ((i + 1) % 100 === 0 || i === list.length - 1) {
    console.log(`  ${i + 1}/${list.length} (ok ${ok}, skip ${skip}, fail ${fail})`);
  }
}

console.log(`Terminé: générés ${ok}, déjà présents ${skip}, échecs ${fail}`);
console.log(`Upload R2 exemple:`);
console.log(
  `  for f in data/og/*; do key="og/$(basename "\${f%.*}")"; npx wrangler r2 object put "panneaux-images/\${key}" --file="\$f" --remote; done`,
);
