import MiniSearch from "minisearch";
import { panneaux } from "./catalog";
import type { Panneau } from "./types";

const mini = new MiniSearch<Panneau>({
  fields: ["code", "nameFr", "nameEn", "descriptionFr", "pathText", "cat", "usage", "couleur"],
  storeFields: ["cid"],
  idField: "cid",
  searchOptions: {
    boost: { code: 4, nameFr: 2, nameEn: 1.5, descriptionFr: 1 },
    prefix: true,
    fuzzy: 0.2,
  },
  extractField(doc, field) {
    if (field === "pathText") return doc.category.pathFr.join(" ");
    if (field === "cat") return doc.category.cat;
    return (doc as Record<string, unknown>)[field] as string;
  },
});

mini.addAll(panneaux);

const byCid = new Map(panneaux.map((p) => [p.cid, p]));

export type SearchFilters = {
  /** Top-level category cat codes, e.g. PRESC, DANGR */
  cats?: string[];
  hasDevis?: boolean;
  /** Code prefix like "P-", "D-", "T-" */
  codePrefix?: string;
};

export function searchPanneaux(
  query: string,
  filters: SearchFilters = {},
  limit = 50,
): Panneau[] {
  const q = query.trim();
  const cats = filters.cats?.length ? new Set(filters.cats) : null;
  const prefix = filters.codePrefix?.toUpperCase();

  const matches = (p: Panneau) =>
    (!cats || cats.has(p.category.cat) || cats.has(p.category.che.split("-")[0] ?? "")) &&
    (!filters.hasDevis || p.hasDevis) &&
    (!prefix || p.code.toUpperCase().startsWith(prefix));

  // MiniSearch results are already ranked; no query keeps catalog order.
  const candidates: Iterable<Panneau> = q
    ? mini
        .search(q)
        .map((h) => byCid.get(h.id as number))
        .filter((p): p is Panneau => p != null)
    : panneaux;

  const out: Panneau[] = [];
  for (const p of candidates) {
    if (!matches(p)) continue;
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}
