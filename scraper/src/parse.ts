import * as cheerio from "cheerio";
import type { ScrapedListItem } from "./types.js";

/**
 * Parse list cards from Panneaux.aspx HTML.
 * Structure (from archived pages):
 *   a[href*="Details.aspx?cid="] containing img + code + name
 *   devis link Utilitaires/Devis.aspx?cid=
 */
export function parseListPage(
  html: string,
  ctx: { che: string; cat: string; pathFr: string[] },
): ScrapedListItem[] {
  const $ = cheerio.load(html);
  const byCid = new Map<number, ScrapedListItem>();

  $('a[href*="Details.aspx"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const cidMatch = href.match(/[?&]cid=(\d+)/i);
    if (!cidMatch) return;
    const cid = Number(cidMatch[1]);
    if (!Number.isFinite(cid)) return;

    const text = $(el).text().replace(/\s+/g, " ").trim();
    // Prefer bold code/name structure
    const strongs = $(el)
      .find("strong, b")
      .map((__, s) => $(s).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);

    let code = strongs[0] ?? "";
    let nameFr = strongs.slice(1).join(" ") || text;

    if (!code) {
      // Fallback: first token that looks like a sign code
      const m = text.match(
        /\b([PTDI]-[\w.-]+|T-[A-Z]-[\w.-]+|Rte-[\w.-]+|Aut-[\w.-]+)\b/i,
      );
      code = m?.[1] ?? `CID-${cid}`;
      nameFr = text.replace(code, "").trim() || code;
    }

    // Clean name if it still starts with code
    if (nameFr.toLowerCase().startsWith(code.toLowerCase())) {
      nameFr = nameFr.slice(code.length).trim();
    }

    const parent = $(el).closest("div, li, td, article, section, tr");
    const devisNear =
      parent.find(`a[href*="Devis.aspx"][href*="cid=${cid}"]`).attr("href") ??
      $(el).parent().find(`a[href*="Devis.aspx"][href*="cid=${cid}"]`).attr("href") ??
      $(`a[href*="Devis.aspx"][href*="cid=${cid}"]`).attr("href") ??
      "";
    const hasDevis = /Devis\.aspx/i.test(devisNear);

    // Prefer che/cat from the detail link if present
    const cheMatch = href.match(/[?&]che=([^&]+)/i);
    const catMatch = href.match(/[?&]cat=([^&]+)/i);

    byCid.set(cid, {
      cid,
      code: code.trim(),
      nameFr: nameFr.trim() || code.trim(),
      hasDevis,
      che: cheMatch?.[1] ? decodeURIComponent(cheMatch[1]) : ctx.che,
      cat: catMatch?.[1] ? decodeURIComponent(catMatch[1]) : ctx.cat,
      pathFr: ctx.pathFr,
    });
  });

  return [...byCid.values()];
}

export function parseDetailPage(html: string): {
  descriptionFr?: string;
  nameFr?: string;
  code?: string;
} {
  const $ = cheerio.load(html);
  // Heuristics — RSR markup varies; capture main content text blocks.
  const title =
    $("h1").first().text().replace(/\s+/g, " ").trim() ||
    $("h2").first().text().replace(/\s+/g, " ").trim();

  let code: string | undefined;
  let nameFr: string | undefined;
  if (title) {
    const m = title.match(
      /^([PTDI]-[\w.-]+|T-[A-Z]-[\w.-]+|Rte-[\w.-]+|Aut-[\w.-]+)\s*(.*)$/i,
    );
    if (m) {
      code = m[1];
      nameFr = m[2]?.trim() || undefined;
    } else {
      nameFr = title;
    }
  }

  // Description: longest paragraph in main content
  const paragraphs = $("p")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.length > 40 && !/cookie|javascript|navigateur/i.test(t));

  paragraphs.sort((a, b) => b.length - a.length);
  const descriptionFr = paragraphs[0];

  return { descriptionFr, nameFr, code };
}

export function categoryListUrl(che: string, cat: string): string {
  return `https://www.rsr.transports.gouv.qc.ca/Dispositifs/Panneaux.aspx?che=${encodeURIComponent(che)}&cat=${encodeURIComponent(cat)}`;
}

export function detailUrl(cid: number, che: string, cat: string): string {
  return `https://www.rsr.transports.gouv.qc.ca/Dispositifs/Details.aspx?cid=${cid}&che=${encodeURIComponent(che)}&cat=${encodeURIComponent(cat)}`;
}

export function imageUrl(cid: number): string {
  return `https://www.rsr.transports.gouv.qc.ca/Gestionnaires/ObtenirImage.ashx?imgId=${cid}`;
}
