import MiniSearch from "minisearch";
import { panneaux } from "./catalog";
import type { Panneau } from "./types";

export type SearchHit = Panneau & { score?: number };

const mini = new MiniSearch<Panneau>({
  fields: ["code", "nameFr", "nameEn", "descriptionFr", "pathText", "cat"],
  storeFields: ["cid"],
  idField: "cid",
  searchOptions: {
    boost: { code: 4, nameFr: 2, nameEn: 1.5 },
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
): SearchHit[] {
  const q = query.trim();
  let results: SearchHit[];

  if (!q) {
    results = [...panneaux];
  } else {
    const hits = mini.search(q);
    const mapped: SearchHit[] = [];
    for (const h of hits) {
      const p = byCid.get(Number(h.id));
      if (p) mapped.push({ ...p, score: h.score });
    }
    results = mapped;
  }

  if (filters.cats?.length) {
    const set = new Set(filters.cats);
    results = results.filter(
      (p) => set.has(p.category.cat) || set.has(p.category.che.split("-")[0] ?? ""),
    );
  }

  if (filters.hasDevis === true) {
    results = results.filter((p) => p.hasDevis);
  }

  if (filters.codePrefix) {
    const prefix = filters.codePrefix.toUpperCase();
    results = results.filter((p) => p.code.toUpperCase().startsWith(prefix));
  }

  return results.slice(0, limit);
}
