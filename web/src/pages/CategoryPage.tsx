import { Link, useParams } from "react-router-dom";
import { PanneauGrid } from "../components/PanneauGrid";
import {
  findCategoryBySlug,
  panneauxInCategory,
  topCategories,
} from "../lib/catalog";

export function CategoryPage() {
  const { slug = "" } = useParams();
  const node = findCategoryBySlug(slug);

  if (!node) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Catégorie introuvable</h1>
        <Link to="/categories" className="text-brand-600 hover:underline">
          ← Retour aux catégories
        </Link>
      </div>
    );
  }

  const items = panneauxInCategory(node);
  const parent = findParent(node.slug);

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500" aria-label="Fil d'Ariane">
        <Link to="/categories" className="hover:text-slate-800">
          Catégories
        </Link>
        {parent && (
          <>
            <span className="mx-1.5">/</span>
            <Link to={`/categorie/${parent.slug}`} className="hover:text-slate-800">
              {parent.nameFr}
            </Link>
          </>
        )}
        <span className="mx-1.5">/</span>
        <span className="text-slate-800">{node.nameFr}</span>
      </nav>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{node.nameFr}</h1>
        {node.descriptionFr && <p className="text-slate-600">{node.descriptionFr}</p>}
        <p className="text-sm text-slate-500">
          {items.length} panneau{items.length === 1 ? "" : "x"}
        </p>
      </div>

      {node.children.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {node.children.map((child) => (
            <Link
              key={child.cat}
              to={`/categorie/${child.slug}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-300"
            >
              {child.nameFr}
            </Link>
          ))}
        </div>
      )}

      <PanneauGrid
        items={items}
        emptyMessage="Aucun panneau dans cette catégorie pour l’échantillon actuel. Lancez un scrape complet."
      />
    </div>
  );
}

function findParent(slug: string) {
  for (const top of topCategories) {
    if (top.children.some((c) => c.slug === slug || findIn(c, slug))) {
      // Prefer immediate parent
      const walk = (node: typeof top): typeof top | null => {
        for (const child of node.children) {
          if (child.slug === slug) return node;
          const deeper = walk(child);
          if (deeper) return deeper;
        }
        return null;
      };
      return walk(top);
    }
  }
  return null;
}

function findIn(
  node: (typeof topCategories)[0],
  slug: string,
): boolean {
  if (node.slug === slug) return true;
  return node.children.some((c) => findIn(c, slug));
}
