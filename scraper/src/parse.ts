import * as cheerio from "cheerio";
import type { DetailFields, ScrapedListItem } from "./types.js";

const CODE_RE =
  /\b((?:Auto|Rte|Pict|DIV)-[\w.-]+|[PTDI]-[\w.-]+|T-[A-Z]-[\w.-]+)\b/i;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function fieldById($: cheerio.CheerioAPI, id: string): string | undefined {
  const direct = clean($(`#${id}`).text());
  if (direct) return direct;
  // ASP.NET ids sometimes vary slightly; match suffix
  const suffix = id.includes("_") ? id.split("_").slice(-1)[0]! : id;
  const via = clean($(`[id$="_${suffix}"], [id$="${suffix}"]`).first().text());
  return via || undefined;
}

/**
 * Parse list cards from Panneaux.aspx HTML.
 *
 * Card structure:
 *   a.lienCombiner[href*="Details.aspx"][title="Voir le détail du dispositif CODE."]
 *     img[alt=name]
 *     strong: CODE + br + span.nomDispositif
 *   a[href*="Devis.aspx?cid="] when devis exists
 */
export function parseListPage(
  html: string,
  ctx: { che: string; cat: string; pathFr: string[] },
): ScrapedListItem[] {
  const $ = cheerio.load(html);
  const byCid = new Map<number, ScrapedListItem>();

  $("a.lienCombiner[href*='Details.aspx'], a[href*='Details.aspx']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const cidMatch = href.match(/[?&]cid=(\d+)/i);
    if (!cidMatch) return;
    const cid = Number(cidMatch[1]);
    if (!Number.isFinite(cid)) return;

    const title = $(el).attr("title") ?? "";
    const codeFromTitle = title.match(/dispositif\s+(.+?)\.?\s*$/i)?.[1]?.trim();

    const strong = $(el).find("strong").first();
    const nomSpan = strong.find("span.nomDispositif").text();
    // strong text without the name span ≈ code (may include <br>)
    let codeFromStrong = "";
    if (strong.length) {
      const clone = strong.clone();
      clone.find("span.nomDispositif").remove();
      codeFromStrong = clean(clone.text());
    }

    const imgAlt = $(el).find("img").attr("alt") ?? "";
    let code = codeFromTitle || codeFromStrong;
    let nameFr = clean(nomSpan) || clean(imgAlt);

    if (!code) {
      const m = clean($(el).text()).match(CODE_RE);
      code = m?.[1] ?? `CID-${cid}`;
    }
    if (!nameFr) {
      nameFr = code;
    }

    // Devis: prefer same-card devis link, else any devis for this cid
    const card =
      $(el).closest(".fond, .dispositif, li, .rptModele, [id*='rptModele']") ||
      $(el).parent();
    let hasDevis = false;
    const devisInCard = card.find(`a[href*='Devis.aspx'][href*='cid=${cid}']`);
    if (devisInCard.length) {
      hasDevis = true;
    } else if ($(`a[href*='Devis.aspx'][href*='cid=${cid}']`).length) {
      hasDevis = true;
    } else if (
      card.find(`[id*='divAvecDevis']`).length &&
      card.find(`a[href*='Devis.aspx']`).length
    ) {
      hasDevis = true;
    }

    const cheMatch = href.match(/[?&]che=([^&]+)/i);
    const catMatch = href.match(/[?&]cat=([^&]+)/i);

    byCid.set(cid, {
      cid,
      code,
      nameFr,
      hasDevis,
      che: cheMatch?.[1] ? decodeURIComponent(cheMatch[1]) : ctx.che,
      cat: catMatch?.[1] ? decodeURIComponent(catMatch[1]) : ctx.cat,
      pathFr: ctx.pathFr,
    });
  });

  return [...byCid.values()];
}

/** Parse "Page X sur Y" from list HTML. */
export function parseListPagination(html: string): { page: number; total: number } | null {
  const m = html.match(/Page\s+(\d+)\s+sur\s+(\d+)/i);
  if (!m) return null;
  return { page: Number(m[1]), total: Number(m[2]) };
}

/**
 * Parse Details.aspx using official field IDs.
 */
export function parseDetailPage(html: string): DetailFields {
  const $ = cheerio.load(html);

  const code = fieldById($, "ctl00_cphContenu_FicheDetails_txtNumero");
  const nameFr = fieldById($, "ctl00_cphContenu_FicheDetails_txtNom");
  const descriptionFr = fieldById($, "ctl00_cphContenu_FicheDetails_txtDescription");
  const usage = fieldById($, "ctl00_cphContenu_FicheDetails_txtUsage");
  const couleur = fieldById($, "ctl00_cphContenu_FicheDetails_txtCouleur");
  const pellicule = fieldById($, "ctl00_cphContenu_FicheDetails_txtTypePellicule");
  const tomeV = fieldById($, "ctl00_cphContenu_FicheDetails_txtReferenceTomeV");

  // RSR renders either divAvecDevis or divSansDevis
  const hasDevis =
    $("[id$='divAvecDevis']").length > 0 ||
    ($("a.btn_devis_contenu[href*='Devis.aspx']").length > 0 &&
      $("[id$='divSansDevis']").length === 0);

  const imgAlt = $('img[src*="ObtenirImage"]').attr("alt") || undefined;

  return {
    code,
    nameFr,
    descriptionFr,
    usage,
    couleur,
    pellicule,
    tomeV,
    hasDevis,
    imgAlt,
  };
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
