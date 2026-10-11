import { Link, useParams } from "react-router-dom";
import { PanneauGrid } from "../components/PanneauGrid";
import { Seo } from "../components/Seo";
import {
  findCategoryBySlug,
  findParentCategory,
  panneauxInCategory,
} from "../lib/catalog";
import { panneauxCount } from "../lib/format";

export function CategoryPage() {
  const { slug = "" } = useParams();
  const node = findCategoryBySlug(slug);

  if (!node) {
    return (
      <div className="space-y-4">
        <Seo title="Catégorie introuvable" path={`/categorie/${slug}`} noindex />
        <h1 className="text-2xl font-bold">Catégorie introuvable</h1>
        <Link to="/categories" className="text-brand-600 hover:underline">
          ← Retour aux catégories
        </Link>
      </div>
    );
  }

  const items = panneauxInCategory(node);
  const parent = findParentCategory(node);
  const desc =
    node.descriptionFr ||
    `Panneaux de signalisation « ${node.nameFr} » au Québec (${items.length} dispositifs).`;

  return (
    <div className="space-y-6">
      <Seo
        title={`${node.nameFr} — panneaux de signalisation Québec`}
        description={desc}
        path={`/categorie/${node.slug}`}
      />
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
        <p className="text-sm text-slate-500">{panneauxCount(items.length)}</p>
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
