#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./config.js";
import { runCrawl } from "./crawl.js";

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const sample = hasFlag("--sample");
  const headless = !hasFlag("--headed");
  const skipDetails = hasFlag("--skip-details");
  const skipImages = hasFlag("--skip-images");
  const delayMs = Number(getArg("--delay") ?? "750");

  console.log("Panneaux QC — scrape RSR");
  console.log(
    JSON.stringify(
      { sample, headless, skipDetails, skipImages, delayMs },
      null,
      2,
    ),
  );

  try {
    const { catalog, report } = await runCrawl({
      sample,
      headless,
      skipDetails,
      skipImages,
      delayMs,
    });

    await fs.mkdir(DATA_DIR, { recursive: true });
    const catalogPath = path.join(DATA_DIR, "panneaux.json");
    const reportPath = path.join(DATA_DIR, "scrape-report.json");

    // Merge with existing sample if sample mode and we want to keep demo data? Overwrite for now.
    await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

    console.log(`Écrit ${catalog.count} panneaux → ${catalogPath}`);
    console.log(`Rapport → ${reportPath}`);
    console.log(
      `Détails: ${report.detailsFetched}, images: ${report.imagesDownloaded}, erreurs: ${report.errors.length}`,
    );
    if (report.errors.length) {
      console.log("Erreurs (aperçu):");
      for (const e of report.errors.slice(0, 10)) {
        console.log(`  - [${e.where}] ${e.message}`);
      }
    }
  } catch (err) {
    console.error("Échec du scrape:", err instanceof Error ? err.message : err);
    console.error(
      "\nAstuce: le site RSR est protégé par Cloudflare. Essayez:\n" +
        "  pnpm scrape:sample -- --headed\n" +
        "pour ouvrir un navigateur et passer le défi manuellement.",
    );
    process.exitCode = 1;
  }
}

main();
