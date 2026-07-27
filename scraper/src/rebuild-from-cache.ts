/**
 * Rebuild data/panneaux.json from cached detail HTML (+ list HTML for categories).
 * Usage: pnpm --filter @panneaux/scraper exec tsx src/rebuild-from-cache.ts
 */
import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_SEEDS, DATA_DIR, CACHE_DIR, PANNEAUX_URL } from "./config.js";
import { detailUrl, parseDetailPage, parseListPage } from "./parse.js";
import type { CatalogFile, Panneau, ScrapedListItem } from "./types.js";

async function main() {
  const htmlDir = path.join(CACHE_DIR, "html");
  const files = await fs.readdir(htmlDir);

  // Index list cards for category context
  const fromList = new Map<number, ScrapedListItem>();
  const seedByCat = new Map(CATEGORY_SEEDS.map((s) => [s.cat, s]));

  for (const f of files.filter((x) => x.startsWith("list_"))) {
    const m = f.match(/^list_([A-Z0-9]+)_p\d+\.html$/i);
    const cat = m?.[1] ?? "";
    const seed = seedByCat.get(cat) ?? {
      che: cat,
      cat,
      pathFr: [cat],
    };
    const html = await fs.readFile(path.join(htmlDir, f), "utf8");
    for (const item of parseListPage(html, seed)) {
      // Prefer first occurrence (list page is authoritative for category)
      if (!fromList.has(item.cid)) fromList.set(item.cid, item);
    }
  }

  // Fallback: previous catalog for category
  let prevByCid = new Map<number, Panneau>();
  try {
    const prev = JSON.parse(
      await fs.readFile(path.join(DATA_DIR, "panneaux.json"), "utf8"),
    ) as CatalogFile;
    prevByCid = new Map(prev.panneaux.map((p) => [p.cid, p]));
  } catch {
    /* no previous */
  }

  const detailFiles = files.filter((f) => f.startsWith("detail_") && f.endsWith(".html"));
  const now = new Date().toISOString();
  const panneaux: Panneau[] = [];
  let parseOk = 0;
  let missingMeta = 0;

  for (const f of detailFiles) {
    const cid = Number(f.match(/detail_(\d+)\.html/)?.[1]);
    if (!Number.isFinite(cid)) continue;

    const html = await fs.readFile(path.join(htmlDir, f), "utf8");
    const detail = parseDetailPage(html);
    const list = fromList.get(cid);
    const prev = prevByCid.get(cid);

    const code = detail.code || list?.code || prev?.code || `CID-${cid}`;
    const nameFr = detail.nameFr || list?.nameFr || prev?.nameFr || code;
    if (detail.code && detail.nameFr) parseOk++;
    else missingMeta++;

    const che = list?.che || prev?.category.che || "UNKNOWN";
    const cat = list?.cat || prev?.category.cat || "UNKNOWN";
    const pathFr = list?.pathFr || prev?.category.pathFr || ["Inconnu"];

    panneaux.push({
      cid,
      code,
      nameFr,
      descriptionFr: detail.descriptionFr || prev?.descriptionFr,
      usage: detail.usage || prev?.usage,
      couleur: detail.couleur || prev?.couleur,
      pellicule: detail.pellicule || prev?.pellicule,
      tomeV: detail.tomeV || prev?.tomeV,
      category: { che, cat, pathFr },
      hasDevis: detail.hasDevis ?? list?.hasDevis ?? prev?.hasDevis ?? false,
      imageKey: String(cid),
      sourceUrl: detailUrl(cid, che, cat),
      scrapedAt: prev?.scrapedAt || now,
    });
  }

  panneaux.sort((a, b) => a.code.localeCompare(b.code, "fr"));

  const catalog: CatalogFile = {
    version: 1,
    scrapedAt: now,
    source: PANNEAUX_URL,
    count: panneaux.length,
    panneaux,
  };

  const out = path.join(DATA_DIR, "panneaux.json");
  await fs.writeFile(out, JSON.stringify(catalog, null, 2) + "\n", "utf8");

  // Quick stats
  const byTop: Record<string, number> = {};
  for (const p of panneaux) {
    const t = p.category.pathFr[0] ?? "?";
    byTop[t] = (byTop[t] || 0) + 1;
  }

  console.log(`Rebuilt ${catalog.count} panneaux → ${out}`);
  console.log(`  detail parse code+name: ${parseOk}, incomplete: ${missingMeta}`);
  console.log(`  list index size: ${fromList.size}`);
  console.log(`  by top category:`, byTop);
  console.log(`  sample:`, panneaux.slice(0, 3).map((p) => `${p.code} — ${p.nameFr}`));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
