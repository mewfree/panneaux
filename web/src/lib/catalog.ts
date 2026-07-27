import categoriesData from "../../../data/categories.json";
import catalogData from "../../../data/panneaux.json";
import type { CatalogFile, CategoriesFile, CategoryNode, Panneau } from "./types";
import { codeToSlug } from "./types";

export const catalog = catalogData as CatalogFile;
export const categoriesFile = categoriesData as CategoriesFile;
export const panneaux: Panneau[] = catalog.panneaux;
export const topCategories: CategoryNode[] = categoriesFile.categories;

const byCode = new Map<string, Panneau>();
const byCid = new Map<number, Panneau>();
const bySlug = new Map<string, Panneau>();

for (const p of panneaux) {
  byCode.set(p.code.toLowerCase(), p);
  byCid.set(p.cid, p);
  bySlug.set(codeToSlug(p.code), p);
}

export function getByCode(code: string): Panneau | undefined {
  return byCode.get(code.toLowerCase());
}

export function getBySlug(slug: string): Panneau | undefined {
  return bySlug.get(slug.toLowerCase()) ?? getByCode(slug);
}

export function getByCid(cid: number): Panneau | undefined {
  return byCid.get(cid);
}

export function findCategoryBySlug(
  slug: string,
  nodes: CategoryNode[] = topCategories,
): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const child = findCategoryBySlug(slug, node.children);
    if (child) return child;
  }
  return undefined;
}

/** Match panneau against a category node (leaf cat or any descendant che prefix). */
export function panneauxInCategory(node: CategoryNode): Panneau[] {
  const leafCats = collectCats(node);
  return panneaux.filter((p) => leafCats.has(p.category.cat));
}

function collectCats(node: CategoryNode, acc = new Set<string>()): Set<string> {
  acc.add(node.cat);
  for (const child of node.children) collectCats(child, acc);
  return acc;
}

export function countForCategory(node: CategoryNode): number {
  return panneauxInCategory(node).length;
}

export function panneauPath(p: Panneau): string {
  return `/panneau/${codeToSlug(p.code)}`;
}

/**
 * Image URL: prefer local/R2 proxy when available; fall back to official RSR.
 * In production with R2, worker serves /img/{imageKey}.
 */
export function imageUrl(p: Panneau): string {
  // Prefer Worker/R2 proxy path (works once images are uploaded).
  // Until then, browser may still 404 — UI shows placeholder.
  return `/img/${p.imageKey}`;
}

export function officialImageFallback(p: Panneau): string {
  return `https://www.rsr.transports.gouv.qc.ca/Gestionnaires/ObtenirImage.ashx?imgId=${p.cid}`;
}
