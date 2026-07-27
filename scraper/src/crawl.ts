import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import {
  CACHE_DIR,
  CATEGORY_SEEDS,
  DEFAULT_DELAY_MS,
  IMAGES_DIR,
  NAV_TIMEOUT_MS,
  PANNEAUX_URL,
} from "./config.js";
import {
  categoryListUrl,
  detailUrl,
  imageUrl,
  parseDetailPage,
  parseListPage,
} from "./parse.js";
import type { CatalogFile, Panneau, ScrapeReport, ScrapedListItem } from "./types.js";

export type CrawlOptions = {
  sample?: boolean;
  /** Max categories in sample mode */
  sampleCategories?: number;
  /** Max items total in sample mode */
  sampleItems?: number;
  headless?: boolean;
  delayMs?: number;
  skipDetails?: boolean;
  skipImages?: boolean;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureDirs() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });
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
      // Cloudflare interstitial
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

/**
 * Try to set "100 per page" if the control exists (reduces postback pagination).
 */
async function trySetPageSize(page: Page): Promise<void> {
  const selectors = [
    'select[name*="PageSize"]',
    'select[id*="PageSize"]',
    'select[name*="pageSize"]',
    'select[id*="ddl"]',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try {
        await el.selectOption({ label: "100" }).catch(async () => {
          await el.selectOption("100");
        });
        await page.waitForLoadState("domcontentloaded");
        return;
      } catch {
        /* ignore */
      }
    }
  }
}

async function collectAllListItems(
  page: Page,
  seed: (typeof CATEGORY_SEEDS)[0],
  delayMs: number,
): Promise<ScrapedListItem[]> {
  const url = categoryListUrl(seed.che, seed.cat);
  await gotoWithRetry(page, url);
  await trySetPageSize(page);
  await sleep(delayMs);

  const all = new Map<number, ScrapedListItem>();
  let pageNum = 1;
  const maxPages = 200;

  while (pageNum <= maxPages) {
    const html = await page.content();
    await saveHtml(`list_${seed.cat}_p${pageNum}`, html);
    const items = parseListPage(html, seed);
    for (const item of items) all.set(item.cid, item);

    // Next page via ASP.NET postback link
    const next = page.locator(
      'a:has-text("Suivante"), a[title*="Suivante"], a:has-text(">")',
    ).first();
    const disabled =
      (await next.count()) === 0 ||
      (await next.getAttribute("disabled")) != null ||
      (await next.getAttribute("class"))?.includes("disabled") ||
      (await next.evaluate((el) => {
        const a = el as HTMLAnchorElement;
        return (
          a.getAttribute("href") === "#" ||
          a.classList.contains("aspNetDisabled") ||
          getComputedStyle(a).pointerEvents === "none"
        );
      }).catch(() => true));

    if (disabled || items.length === 0) break;

    const before = await page.content();
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null),
        next.click(),
      ]);
    } catch {
      break;
    }
    await sleep(delayMs);
    const after = await page.content();
    if (after === before) break;
    pageNum += 1;
  }

  return [...all.values()];
}

async function downloadImage(
  page: Page,
  cid: number,
): Promise<boolean> {
  const dest = path.join(IMAGES_DIR, `${cid}.png`);
  try {
    await fs.access(dest);
    return true; // already cached
  } catch {
    /* download */
  }

  const url = imageUrl(cid);
  const res = await page.request.get(url);
  if (!res.ok()) return false;
  const buf = await res.body();
  // Detect extension from content-type
  const ct = res.headers()["content-type"] ?? "image/png";
  const ext = ct.includes("jpeg") || ct.includes("jpg") ? "jpg" : ct.includes("gif") ? "gif" : ct.includes("webp") ? "webp" : "png";
  const finalPath = path.join(IMAGES_DIR, `${cid}.${ext}`);
  await fs.writeFile(finalPath, buf);
  // Also write .png alias path for stable imageKey if not png
  if (ext !== "png") {
    await fs.writeFile(dest, buf).catch(() => undefined);
  }
  return true;
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

  await ensureDirs();

  const report: ScrapeReport = {
    startedAt: new Date().toISOString(),
    finishedAt: "",
    sample,
    categoriesAttempted: 0,
    itemsListed: 0,
    detailsFetched: 0,
    imagesDownloaded: 0,
    errors: [],
  };

  let browser: Browser | null = null;
  const listed: ScrapedListItem[] = [];

  try {
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      locale: "fr-CA",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PanneauxQC-Scraper/0.1 (+https://github.com/mewfree/panneaux; reference catalog)",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT_MS);

    // Warm-up homepage (may hit CF challenge)
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

    const seeds = sample ? CATEGORY_SEEDS.slice(0, sampleCategories) : CATEGORY_SEEDS;

    for (const seed of seeds) {
      report.categoriesAttempted += 1;
      try {
        const items = await collectAllListItems(page, seed, delayMs);
        for (const item of items) listed.push(item);
        if (sample && listed.length >= sampleItems) break;
      } catch (err) {
        report.errors.push({
          where: `list:${seed.cat}`,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Dedupe by cid
    const unique = new Map<number, ScrapedListItem>();
    for (const item of listed) unique.set(item.cid, item);
    let items = [...unique.values()];
    if (sample) items = items.slice(0, sampleItems);
    report.itemsListed = items.length;

    const panneaux: Panneau[] = [];
    const now = new Date().toISOString();

    for (const item of items) {
      let descriptionFr: string | undefined;
      let nameFr = item.nameFr;
      let code = item.code;

      if (!opts.skipDetails) {
        try {
          const url = detailUrl(item.cid, item.che, item.cat);
          await gotoWithRetry(page, url);
          await sleep(delayMs);
          const html = await page.content();
          await saveHtml(`detail_${item.cid}`, html);
          const detail = parseDetailPage(html);
          descriptionFr = detail.descriptionFr;
          if (detail.nameFr) nameFr = detail.nameFr;
          if (detail.code) code = detail.code;
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
          const ok = await downloadImage(page, item.cid);
          if (ok) report.imagesDownloaded += 1;
        } catch (err) {
          report.errors.push({
            where: `image:${item.cid}`,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      panneaux.push({
        cid: item.cid,
        code,
        nameFr,
        descriptionFr,
        category: {
          che: item.che,
          cat: item.cat,
          pathFr: item.pathFr,
        },
        hasDevis: item.hasDevis,
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
