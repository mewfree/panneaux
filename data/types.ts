/** Shared catalog types (used by scraper + web). */

export type CategoryNode = {
  cat: string;
  che: string;
  slug: string;
  nameFr: string;
  nameEn?: string;
  descriptionFr?: string;
  children: CategoryNode[];
};

export type CategoriesFile = {
  scrapedAt: string;
  categories: CategoryNode[];
};

export type PanneauCategory = {
  che: string;
  cat: string;
  pathFr: string[];
  pathEn?: string[];
};

export type Panneau = {
  cid: number;
  code: string;
  nameFr: string;
  nameEn?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  /** Usages (ex. Route, Autoroute) */
  usage?: string;
  couleur?: string;
  /** Type(s) de pellicule (ex. IV) */
  pellicule?: string;
  /** Référence Tome V */
  tomeV?: string;
  category: PanneauCategory;
  hasDevis: boolean;
  imageKey: string;
  sourceUrl: string;
  scrapedAt: string;
};

export type CatalogFile = {
  version: number;
  scrapedAt: string;
  source: string;
  count: number;
  panneaux: Panneau[];
};

export const RSR_HOME = "https://www.rsr.transports.gouv.qc.ca/";

export function devisUrl(cid: number): string {
  return `https://www.rsr.transports.gouv.qc.ca/Utilitaires/Devis.aspx?cid=${cid}`;
}

export function officialImageUrl(cid: number): string {
  return `https://www.rsr.transports.gouv.qc.ca/Gestionnaires/ObtenirImage.ashx?imgId=${cid}`;
}

/**
 * Deep links to Details.aspx expire (« Session expirée ») without an ASP.NET
 * session. Prefer the category list — it starts a fresh session in the browser.
 */
export function officialCategoryUrl(che: string, cat: string): string {
  return `https://www.rsr.transports.gouv.qc.ca/Dispositifs/Panneaux.aspx?che=${encodeURIComponent(che)}&cat=${encodeURIComponent(cat)}`;
}

/** @deprecated Prefer officialCategoryUrl — Details.aspx needs a live RSR session. */
export function officialDetailUrl(cid: number, che: string, cat: string): string {
  return `https://www.rsr.transports.gouv.qc.ca/Dispositifs/Details.aspx?cid=${cid}&che=${encodeURIComponent(che)}&cat=${encodeURIComponent(cat)}`;
}

export function codeToSlug(code: string): string {
  return code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
