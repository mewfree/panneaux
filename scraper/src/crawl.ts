import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import {
  CACHE_DIR,
  CATEGORY_SEEDS,
  DATA_DIR,
  DEFAULT_DELAY_MS,
  NAV_TIMEOUT_MS,
  PANNEAUX_URL,
} from "./config.js";
import { downloadImage, ensureImagesDir, watchImageResponse } from "./images.js";
import {
  categoryListUrl,
  detailUrl,
  parseDetailPage,
  parseListPage,
  parseListPagination,
} from "./parse.js";
import type { CatalogFile, Panneau, ScrapeReport, ScrapedListItem } from "./types.js";

export type CrawlOptions = {
  sample?: boolean;
  sampleCategories?: number;
  sampleItems?: number;
  headless?: boolean;
  delayMs?: number;
  skipDetails?: boolean;
  skipImages?: boolean;
  /** Only download images for cids already in data/panneaux.json */
  imagesOnly?: boolean;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureDirs() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await ensureImagesDir();
  await fs.mkdir(path.join(CACHE_DIR, "html"), { recursive: true });
}

async function saveHtml(name: string, html: string) {
  const safe = name.replace(/[^a-z0-9._-]+/gi, "_");
  await fs.writeFile(path.join(CACHE_DIR, "html", `${safe}.html`), html, "utf8");
}

async function gotoWithRetry(page: Page, url: string, retries = 3): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
      if (res && (res.status() === 403 || res.status() === 503)) {
        throw new Error(`HTTP ${res.status()} for ${url}`);
      }
      const title = await page.title();
      if (/just a moment|attention required|accès refusé|access denied/i.test(title)) {
        throw new Error(`Blocked by protection (title: ${title})`);
      }
      return;
    } catch (err) {
      lastErr = err;
      await sleep(1500 * (i + 1));
    }
  }
  throw lastErr;
}

/** Set page size to 100 via the real RSR control. */
async function trySetPageSize(page: Page): Promise<boolean> {
  const sel = page.locator("#ctl00_cphContenu_Visionneuse_NombreElements");
  if ((await sel.count()) === 0) return false;

  const current = await sel.inputValue().catch(() => "");
  if (current === "100") return true;

  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null),
      sel.selectOption("100"),
    ]);
    await sleep(500);
    return true;
  } catch {
    try {
      await sel.selectOption("100");
      await page.waitForLoadState("domcontentloaded");
      return true;
    } catch {
      return false;
    }
  }
}

function firstCids(items: ScrapedListItem[], n = 3): string {
  return items
    .slice(0, n)
    .map((i) => i.cid)
    .join(",");
}

async function collectAllListItems(
  page: Page,
  seed: (typeof CATEGORY_SEEDS)[0],
  delayMs: number,
  report: ScrapeReport,
): Promise<ScrapedListItem[]> {
  const url = categoryListUrl(seed.che, seed.cat);
  await gotoWithRetry(page, url);
  await trySetPageSize(page);
  await sleep(delayMs);

  const all = new Map<number, ScrapedListItem>();
  let pageNum = 1;
  const maxPages = 300;
  let lastSignature = "";

  while (pageNum <= maxPages) {
    const html = await page.content();
    await saveHtml(`list_${seed.cat}_p${pageNum}`, html);
    report.pagesCrawled += 1;

    const items = parseListPage(html, seed);
    const pagination = parseListPagination(html);
    const signature = firstCids(items);

    if (signature && signature === lastSignature && pageNum > 1) {
      report.errors.push({
        where: `list:${seed.cat}:p${pageNum}`,
        message: "Pagination stuck (same items as previous page)",
      });
      break;
    }
    lastSignature = signature;

    for (const item of items) all.set(item.cid, item);

    console.log(
      `  [${seed.cat}] page ${pagination?.page ?? pageNum}/${pagination?.total ?? "?"} → ${items.length} items (total ${all.size})`,
    );

    if (items.length === 0) break;
    if (pagination && pagination.page >= pagination.total) break;

    // Official next control
    const next = page.locator("#ctl00_cphContenu_Visionneuse_lnkPageSuivante");
    if ((await next.count()) === 0) break;

    const nextClass = (await next.getAttribute("class")) ?? "";
    const nextHref = (await next.getAttribute("href")) ?? "";
    if (
      nextClass.includes("aspNetDisabled") ||
      nextClass.includes("disabled") ||
      !nextHref ||
      nextHref === "#"
    ) {
      break;
    }

    const beforePag = pagination?.page ?? pageNum;
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => null),
        next.click(),
      ]);
    } catch (err) {
      report.errors.push({
        where: `list:${seed.cat}:next`,
        message: err instanceof Error ? err.message : String(err),
      });
      break;
    }

    await sleep(delayMs);
    const afterHtml = await page.content();
    const afterPag = parseListPagination(afterHtml);
    if (afterPag && afterPag.page === beforePag) {
      // try one more time with longer wait
      await sleep(delayMs);
      const retryPag = parseListPagination(await page.content());
      if (retryPag && retryPag.page === beforePag) {
        report.errors.push({
          where: `list:${seed.cat}:next`,
          message: `Next click did not advance past page ${beforePag}`,
        });
        break;
      }
    }

    pageNum += 1;
  }

  return [...all.values()];
}

export async function runCrawl(opts: CrawlOptions = {}): Promise<{
  catalog: CatalogFile;
  report: ScrapeReport;
}> {
  const sample = opts.sample ?? false;
  const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
  const headless = opts.headless ?? true;
  const sampleCategories = opts.sampleCategories ?? 3;
  const sampleItems = opts.sampleItems ?? 20;
  const imagesOnly = opts.imagesOnly ?? false;

  await ensureDirs();

  const report: ScrapeReport = {
    startedAt: new Date().toISOString(),
    finishedAt: "",
    sample,
    categoriesAttempted: 0,
    itemsListed: 0,
    detailsFetched: 0,
    imagesDownloaded: 0,
    imageFailures: 0,
    pagesCrawled: 0,
    errors: [],
  };

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      locale: "fr-CA",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PanneauxQC-Scraper/0.1 (+https://github.com/mewfree/panneaux; reference catalog)",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT_MS);

    try {
      await gotoWithRetry(page, PANNEAUX_URL);
      await saveHtml("warmup_panneaux", await page.content());
    } catch (err) {
      report.errors.push({
        where: "warmup",
        message: err instanceof Error ? err.message : String(err),
      });
      throw new Error(
        `Impossible d'accéder au RSR (Cloudflare ou réseau). ` +
          `Relancez avec --headed pour résoudre le défi manuellement. ` +
          `Détail: ${err instanceof Error ? err.message : err}`,
      );
    }

    // --- Images-only path: reuse existing catalog, visit detail pages for images ---
    if (imagesOnly) {
      const catalogPath = path.join(DATA_DIR, "panneaux.json");
      const existing = JSON.parse(await fs.readFile(catalogPath, "utf8")) as CatalogFile;
      report.itemsListed = existing.panneaux.length;
      console.log(`Images only: ${existing.panneaux.length} panneaux from catalog`);

      for (const [idx, p] of existing.panneaux.entries()) {
        try {
          const imgWatch = watchImageResponse(page, p.cid);
          await gotoWithRetry(page, p.sourceUrl);
          await sleep(Math.min(delayMs, 400));
          const netRes = await imgWatch;
          const result = await downloadImage(page, p.cid, { networkResponse: netRes });
          if (result.ok) {
            report.imagesDownloaded += 1;
            if (result.method && report.imagesDownloaded <= 5) {
              console.log(`  image ${p.cid} via ${result.method}`);
            }
          } else {
            report.imageFailures += 1;
            if (report.imageFailures <= 20) {
              report.errors.push({
                where: `image:${p.cid}`,
                message: result.reason ?? "download failed",
              });
            }
          }
        } catch (err) {
          report.imageFailures += 1;
          report.errors.push({
            where: `image:${p.cid}`,
            message: err instanceof Error ? err.message : String(err),
          });
        }
        if ((idx + 1) % 50 === 0 || idx === existing.panneaux.length - 1) {
          console.log(
            `  images ${idx + 1}/${existing.panneaux.length} (ok ${report.imagesDownloaded}, fail ${report.imageFailures})`,
          );
        }
      }

      report.finishedAt = new Date().toISOString();
      return { catalog: existing, report };
    }

    const listed: ScrapedListItem[] = [];
    const seeds = sample ? CATEGORY_SEEDS.slice(0, sampleCategories) : CATEGORY_SEEDS;

    for (const seed of seeds) {
      report.categoriesAttempted += 1;
      console.log(`Catégorie ${seed.cat} (${seed.pathFr.join(" > ")})…`);
      try {
        const items = await collectAllListItems(page, seed, delayMs, report);
        for (const item of items) listed.push(item);
        if (sample && listed.length >= sampleItems) break;
      } catch (err) {
        report.errors.push({
          where: `list:${seed.cat}`,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const unique = new Map<number, ScrapedListItem>();
    for (const item of listed) unique.set(item.cid, item);
    let items = [...unique.values()];
    if (sample) items = items.slice(0, sampleItems);
    report.itemsListed = items.length;
    console.log(`Liste: ${items.length} dispositifs uniques`);

    const panneaux: Panneau[] = [];
    const now = new Date().toISOString();

    for (const [idx, item] of items.entries()) {
      let descriptionFr: string | undefined;
      let nameFr = item.nameFr;
      let code = item.code;
      let usage: string | undefined;
      let couleur: string | undefined;
      let pellicule: string | undefined;
      let tomeV: string | undefined;
      let hasDevis = item.hasDevis;
      let networkResponse = null as Awaited<ReturnType<typeof watchImageResponse>>;

      if (!opts.skipDetails) {
        try {
          const url = detailUrl(item.cid, item.che, item.cat);
          const imgWatch = opts.skipImages ? null : watchImageResponse(page, item.cid);
          await gotoWithRetry(page, url);
          await sleep(delayMs);
          if (imgWatch) networkResponse = await imgWatch;
          const html = await page.content();
          await saveHtml(`detail_${item.cid}`, html);
          const detail = parseDetailPage(html);
          if (detail.descriptionFr) descriptionFr = detail.descriptionFr;
          if (detail.nameFr) nameFr = detail.nameFr;
          if (detail.code) code = detail.code;
          usage = detail.usage;
          couleur = detail.couleur;
          pellicule = detail.pellicule;
          tomeV = detail.tomeV;
          if (detail.hasDevis != null) hasDevis = detail.hasDevis;
          report.detailsFetched += 1;
        } catch (err) {
          report.errors.push({
            where: `detail:${item.cid}`,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (!opts.skipImages) {
        try {
          // If details skipped, still open detail for image load
          if (opts.skipDetails) {
            const imgWatch = watchImageResponse(page, item.cid);
            await gotoWithRetry(page, detailUrl(item.cid, item.che, item.cat));
            await sleep(Math.min(delayMs, 400));
            networkResponse = await imgWatch;
          }
          const result = await downloadImage(page, item.cid, { networkResponse });
          if (result.ok) {
            report.imagesDownloaded += 1;
          } else {
            report.imageFailures += 1;
            if (report.imageFailures <= 20) {
              report.errors.push({
                where: `image:${item.cid}`,
                message: `${result.reason ?? "download failed"}${result.method ? ` [${result.method}]` : ""}`,
              });
            }
          }
        } catch (err) {
          report.imageFailures += 1;
          report.errors.push({
            where: `image:${item.cid}`,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if ((idx + 1) % 25 === 0 || idx === items.length - 1) {
        console.log(
          `  détails/images ${idx + 1}/${items.length} (img ok ${report.imagesDownloaded}, fail ${report.imageFailures})`,
        );
      }

      panneaux.push({
        cid: item.cid,
        code,
        nameFr,
        descriptionFr,
        usage,
        couleur,
        pellicule,
        tomeV,
        category: {
          che: item.che,
          cat: item.cat,
          pathFr: item.pathFr,
        },
        hasDevis,
        imageKey: String(item.cid),
        sourceUrl: detailUrl(item.cid, item.che, item.cat),
        scrapedAt: now,
      });
    }

    const catalog: CatalogFile = {
      version: 1,
      scrapedAt: now,
      source: PANNEAUX_URL,
      count: panneaux.length,
      panneaux: panneaux.sort((a, b) => a.code.localeCompare(b.code, "fr")),
    };

    report.finishedAt = new Date().toISOString();
    return { catalog, report };
  } finally {
    await browser?.close();
  }
}
