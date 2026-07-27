import fs from "node:fs/promises";
import path from "node:path";
import type { Page, Response } from "playwright";
import { IMAGES_DIR } from "./config.js";
import { imageUrl } from "./parse.js";

export async function ensureImagesDir() {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
}

export async function imageAlreadyOnDisk(cid: number): Promise<boolean> {
  for (const ext of ["png", "jpg", "gif", "webp"]) {
    try {
      await fs.access(path.join(IMAGES_DIR, `${cid}.${ext}`));
      return true;
    } catch {
      /* continue */
    }
  }
  return false;
}

function sniffExt(buf: Buffer, contentType?: string | null): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (buf[0] === 0x47 && buf[1] === 0x49) return "gif";
  if (buf[0] === 0x52 && buf[1] === 0x49) return "webp";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "png";
  const ct = contentType ?? "";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("webp")) return "webp";
  return "png";
}

async function writeImage(cid: number, buf: Buffer, contentType?: string | null) {
  if (buf.length < 50) throw new Error(`body too small (${buf.length}b)`);
  // Reject HTML error pages
  const head = buf.subarray(0, 20).toString("utf8").toLowerCase();
  if (head.includes("<!doctype") || head.includes("<html")) {
    throw new Error("got HTML instead of image");
  }
  const ext = sniffExt(buf, contentType);
  await fs.writeFile(path.join(IMAGES_DIR, `${cid}.${ext}`), buf);
}

/** True if response is a sign image for this cid (or any ObtenirImage if cid omitted). */
export function isImageResponse(res: Response, cid?: number): boolean {
  const url = res.url();
  if (!/ObtenirImage\.ashx/i.test(url)) return false;
  if (cid != null && !new RegExp(`[?&]imgId=${cid}(?:&|$)`).test(url)) return false;
  return res.status() >= 200 && res.status() < 400;
}

/**
 * Start listening for ObtenirImage network responses before navigation.
 */
export function watchImageResponse(page: Page, cid: number, timeoutMs = 20_000) {
  return page
    .waitForResponse((res) => isImageResponse(res, cid), { timeout: timeoutMs })
    .catch(() => null);
}

export async function saveFromResponse(
  res: Response,
  cid: number,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const buf = Buffer.from(await res.body());
    await writeImage(cid, buf, res.headers()["content-type"]);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Download image using strategies that work under Cloudflare:
 * 1) network response already captured
 * 2) in-page fetch (real browser TLS + cookies)
 * 3) canvas export from loaded <img>
 * 4) element screenshot
 * 5) bare page.request (usually 403 — last resort)
 */
export async function downloadImage(
  page: Page,
  cid: number,
  opts?: { networkResponse?: Response | null },
): Promise<{ ok: boolean; reason?: string; method?: string }> {
  await ensureImagesDir();
  if (await imageAlreadyOnDisk(cid)) {
    return { ok: true, method: "cache" };
  }

  // 1) response captured during detail navigation
  if (opts?.networkResponse) {
    const r = await saveFromResponse(opts.networkResponse, cid);
    if (r.ok) return { ok: true, method: "network" };
  }

  // 2) in-page fetch of absolute image URL
  try {
    const url = imageUrl(cid);
    const result = await page.evaluate(async (imageHref: string) => {
      try {
        const res = await fetch(imageHref, {
          credentials: "include",
          headers: { Accept: "image/*,*/*" },
        });
        if (!res.ok) return { ok: false as const, status: res.status };
        const ab = await res.arrayBuffer();
        const bytes = Array.from(new Uint8Array(ab));
        return {
          ok: true as const,
          bytes,
          contentType: res.headers.get("content-type"),
        };
      } catch (e) {
        return { ok: false as const, status: 0, error: String(e) };
      }
    }, url);

    if (result.ok) {
      const buf = Buffer.from(result.bytes);
      await writeImage(cid, buf, result.contentType);
      return { ok: true, method: "page-fetch" };
    }
  } catch {
    /* try next */
  }

  // 3) canvas from loaded img on detail page
  const img = page.locator('img[src*="ObtenirImage"]').first();
  if ((await img.count()) > 0) {
    try {
      await img.waitFor({ state: "visible", timeout: 8_000 });
      // wait for decode
      await img.evaluate(async (el: HTMLImageElement) => {
        if (!el.complete || el.naturalWidth === 0) {
          await new Promise<void>((resolve, reject) => {
            el.onload = () => resolve();
            el.onerror = () => reject(new Error("img error"));
            setTimeout(() => resolve(), 5000);
          });
        }
      });

      const dataUrl = await img.evaluate((el: HTMLImageElement) => {
        if (!el.naturalWidth) return null;
        const c = document.createElement("canvas");
        c.width = el.naturalWidth;
        c.height = el.naturalHeight;
        const ctx = c.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(el, 0, 0);
        try {
          return c.toDataURL("image/png");
        } catch {
          return null; // tainted canvas
        }
      });

      if (dataUrl?.startsWith("data:image")) {
        const b64 = dataUrl.split(",")[1]!;
        const buf = Buffer.from(b64, "base64");
        await writeImage(cid, buf, "image/png");
        return { ok: true, method: "canvas" };
      }
    } catch {
      /* try screenshot */
    }

    // 4) screenshot the vignette
    try {
      const dest = path.join(IMAGES_DIR, `${cid}.png`);
      await img.screenshot({ path: dest, type: "png" });
      const st = await fs.stat(dest);
      if (st.size > 50) return { ok: true, method: "screenshot" };
      await fs.unlink(dest).catch(() => undefined);
    } catch {
      /* last resort */
    }
  }

  // 5) APIRequestContext (often CF 403)
  try {
    const res = await page.request.get(imageUrl(cid), {
      headers: {
        Referer: "https://www.rsr.transports.gouv.qc.ca/Dispositifs/Panneaux.aspx",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    if (!res.ok()) {
      return { ok: false, reason: `HTTP ${res.status()} (all methods)` };
    }
    const buf = Buffer.from(await res.body());
    await writeImage(cid, buf, res.headers()["content-type"]);
    return { ok: true, method: "request" };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
