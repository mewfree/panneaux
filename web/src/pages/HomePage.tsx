import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SearchBox } from "../components/SearchBox";
import { PanneauGrid } from "../components/PanneauGrid";
import { catalog, countForCategory, topCategories } from "../lib/catalog";
import { searchPanneaux } from "../lib/search";

const CATEGORY_ACCENT: Record<string, string> = {
  DANGR: "border-yellow-300 bg-yellow-50",
  PRESC: "border-red-200 bg-red-50",
  TRAVX: "border-orange-200 bg-orange-50",
  PANCX: "border-slate-200 bg-slate-50",
  INDCT: "border-emerald-200 bg-emerald-50",
};

export function HomePage() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const preview = q.trim() ? searchPanneaux(q, {}, 8) : [];

  return (
    <div className="space-y-12">
      <section className="space-y-6 text-center sm:pt-4">
        <div className="space-y-3">
          <p className="text-sm font-medium tracking-wide text-brand-600 uppercase">
            Signalisation routière · Québec
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Tous les panneaux, une recherche claire
          </h1>
          <p className="mx-auto max-w-2xl text-slate-600">
            Explorez le répertoire des dispositifs de signalisation routière du Québec —
            par code, nom ou catégorie — avec une interface moderne et visuelle.
          </p>
        </div>

        <form
          className="mx-auto max-w-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(q.trim() ? `/recherche?q=${encodeURIComponent(q.trim())}` : "/recherche");
          }}
        >
          <SearchBox value={q} onChange={setQ} size="lg" autoFocus />
          <p className="mt-2 text-left text-xs text-slate-400">
            Ex. <button type="button" className="underline" onClick={() => setQ("P-70")}>P-70</button>
            {", "}
            <button type="button" className="underline" onClick={() => setQ("vitesse")}>vitesse</button>
            {", "}
            <button type="button" className="underline" onClick={() => setQ("danger")}>danger</button>
          </p>
        </form>

        {preview.length > 0 && (
          <div className="text-left">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Aperçu des résultats</h2>
              <Link
                to={`/recherche?q=${encodeURIComponent(q.trim())}`}
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                Voir tout →
              </Link>
            </div>
            <PanneauGrid items={preview} />
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900">Catégories</h2>
          <Link to="/categories" className="text-sm font-medium text-brand-600 hover:underline">
            Toutes les catégories
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topCategories.map((cat) => {
            const n = countForCategory(cat);
            const accent = CATEGORY_ACCENT[cat.cat] ?? "border-slate-200 bg-white";
            return (
              <li key={cat.cat}>
                <Link
                  to={`/categorie/${cat.slug}`}
                  className={`flex h-full flex-col rounded-2xl border p-5 transition hover:shadow-md ${accent}`}
                >
                  <span className="text-lg font-semibold text-slate-900">{cat.nameFr}</span>
                  {cat.descriptionFr && (
                    <span className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {cat.descriptionFr}
                    </span>
                  )}
                  <span className="mt-3 text-xs font-medium text-slate-500">
                    {n > 0 ? `${n} dans l’échantillon` : "Voir la catégorie"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <p>
          Catalogue actuel : <strong className="text-slate-800">{catalog.count} panneaux</strong>{" "}
          (échantillon de développement). Lancez le scrape complet pour peupler l’ensemble du
          répertoire RSR.
        </p>
      </section>
    </div>
  );
}
