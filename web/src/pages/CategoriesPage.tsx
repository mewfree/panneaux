import { Link } from "react-router-dom";
import { countForCategory, topCategories } from "../lib/catalog";
import type { CategoryNode } from "../lib/types";

export function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Catégories</h1>
        <p className="text-slate-600">
          Parcourez la hiérarchie du répertoire officiel RSR.
        </p>
      </div>
      <div className="space-y-4">
        {topCategories.map((cat) => (
          <CategoryBlock key={cat.cat} node={cat} depth={0} />
        ))}
      </div>
    </div>
  );
}

function CategoryBlock({ node, depth }: { node: CategoryNode; depth: number }) {
  const count = countForCategory(node);
  return (
    <div className={depth === 0 ? "rounded-2xl border border-slate-200 bg-white p-5" : "ml-4 border-l border-slate-100 pl-4"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          to={`/categorie/${node.slug}`}
          className="font-semibold text-slate-900 hover:text-brand-600"
        >
          {node.nameFr}
        </Link>
        <span className="font-mono text-xs text-slate-400">{node.cat}</span>
      </div>
      {node.descriptionFr && depth === 0 && (
        <p className="mt-1 text-sm text-slate-600">{node.descriptionFr}</p>
      )}
      <p className="mt-1 text-xs text-slate-500">
        {count} panneau{count === 1 ? "" : "x"} dans l’échantillon
      </p>
      {node.children.length > 0 && (
        <div className="mt-3 space-y-3">
          {node.children.map((child) => (
            <CategoryBlock key={child.cat} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
