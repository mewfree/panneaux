import categoriesData from "../../../data/categories.json";
import catalogData from "../../../data/panneaux.json";
import type { CatalogFile, CategoriesFile, CategoryNode, Panneau } from "./types";
import { codeToSlug, officialImageUrl } from "./types";

export const catalog = catalogData as CatalogFile;
export const panneaux: Panneau[] = catalog.panneaux;
export const topCategories: CategoryNode[] = (categoriesData as CategoriesFile).categories;

const byCode = new Map<string, Panneau>();
const bySlug = new Map<string, Panneau>();

for (const p of panneaux) {
  byCode.set(p.code.toLowerCase(), p);
  bySlug.set(codeToSlug(p.code), p);
}

export function getBySlug(slug: string): Panneau | undefined {
  const key = slug.toLowerCase();
  return bySlug.get(key) ?? byCode.get(key);
}

// --- Category index (built once; every lookup below is O(1)) ---

const nodeBySlug = new Map<string, CategoryNode>();
const parentBySlug = new Map<string, CategoryNode>();
const panneauxByCat = new Map<string, Panneau[]>();
const itemsBySlug = new Map<string, Panneau[]>();

for (const p of panneaux) {
  const list = panneauxByCat.get(p.category.cat);
  if (list) list.push(p);
  else panneauxByCat.set(p.category.cat, [p]);
}

/** Indexes `node` and returns every panneau in its subtree. */
function indexNode(node: CategoryNode, parent?: CategoryNode): Panneau[] {
  nodeBySlug.set(node.slug, node);
  if (parent) parentBySlug.set(node.slug, parent);
  const items = [...(panneauxByCat.get(node.cat) ?? [])];
  for (const child of node.children) items.push(...indexNode(child, node));
  itemsBySlug.set(node.slug, items);
  return items;
}

for (const top of topCategories) indexNode(top);

export function findCategoryBySlug(slug: string): CategoryNode | undefined {
  return nodeBySlug.get(slug);
}

/** Immediate parent of a category, or undefined for top-level categories. */
export function findParentCategory(node: CategoryNode): CategoryNode | undefined {
  return parentBySlug.get(node.slug);
}

/** Top-level category a panneau belongs to (first segment of its `che` path). */
export function topCategoryOf(p: Panneau): CategoryNode | undefined {
  const top = p.category.che.split("-")[0];
  return topCategories.find((c) => c.cat === top);
}

/** Panneaux of a category and all its descendants. */
export function panneauxInCategory(node: CategoryNode): Panneau[] {
  return itemsBySlug.get(node.slug) ?? [];
}

export function countForCategory(node: CategoryNode): number {
  return panneauxInCategory(node).length;
}

export function panneauPath(p: Panneau): string {
  return `/panneau/${codeToSlug(p.code)}`;
}

/** Worker/R2 proxy path (/img/{imageKey}); the UI falls back to the official image, then a placeholder. */
export function imageUrl(p: Panneau): string {
  return `/img/${p.imageKey}`;
}

/** Open Graph 1200×630 branded card (Worker: /og/{cid}.png from R2 key og/{cid}). */
export function ogImageUrl(p: Panneau): string {
  return `/og/${p.cid}.png`;
}

export function officialImageFallback(p: Panneau): string {
  return officialImageUrl(p.cid);
}
