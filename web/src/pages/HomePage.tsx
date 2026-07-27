import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FilterChip } from "../components/FilterChip";
import { PanneauGrid } from "../components/PanneauGrid";
import { SearchBox } from "../components/SearchBox";
import { catalog, countForCategory, topCategories } from "../lib/catalog";
import { searchPanneaux } from "../lib/search";

const PAGE_SIZE = 48;
const PREFIXES = ["P-", "D-", "T-", "I-", "Rte-", "Auto-"];

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const catFilter = params.get("cat") ?? "";
  const prefix = params.get("prefix") ?? "";
  const [localQ, setLocalQ] = useState(q);
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Keep local input in sync when navigating with browser back/forward
  useEffect(() => {
    setLocalQ(q);
  }, [q]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [q, catFilter, prefix]);

  const results = useMemo(
    () =>
      searchPanneaux(
        q,
        {
          cats: catFilter ? [catFilter] : undefined,
          codePrefix: prefix || undefined,
        },
        5000,
      ),
    [q, catFilter, prefix],
  );

  const shown = results.slice(0, visible);
  const hasMore = visible < results.length;

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  }

  const filtering = Boolean(q.trim() || catFilter || prefix);

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Panneaux de signalisation du Québec
          </h1>
          <p className="text-slate-600">
            {catalog.count.toLocaleString("fr-CA")} panneaux — cherchez par code ou nom, ou
            parcourez par catégorie.
          </p>
        </div>

        <SearchBox
          value={localQ}
          onChange={(v) => {
            setLocalQ(v);
            update({ q: v });
          }}
          size="lg"
          autoFocus
          placeholder="Code, nom ou mot-clé (ex. P-70, vitesse, arrêt)…"
        />

        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={!catFilter}
            onClick={() => update({ cat: null })}
            label="Tous"
          />
          {topCategories.map((c) => (
            <FilterChip
              key={c.cat}
              active={catFilter === c.cat}
              onClick={() => update({ cat: catFilter === c.cat ? null : c.cat })}
              label={`${c.nameFr} (${countForCategory(c)})`}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Préfixe</span>
          {PREFIXES.map((p) => (
            <FilterChip
              key={p}
              active={prefix === p}
              onClick={() => update({ prefix: prefix === p ? null : p })}
              label={p}
            />
          ))}
          {filtering && (
            <button
              type="button"
              className="ml-1 text-xs font-medium text-brand-600 hover:underline"
              onClick={() => {
                setLocalQ("");
                setParams({}, { replace: true });
              }}
            >
              Réinitialiser
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-slate-500">
          {results.length.toLocaleString("fr-CA")} panneau
          {results.length === 1 ? "" : "x"}
          {q.trim() ? (
            <>
              {" "}
              pour « <span className="font-medium text-slate-700">{q.trim()}</span> »
            </>
          ) : null}
          {shown.length < results.length ? (
            <span className="text-slate-400">
              {" "}
              · affichage de {shown.length.toLocaleString("fr-CA")}
            </span>
          ) : null}
        </p>
        <Link
          to="/categories"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          Arborescence des catégories →
        </Link>
      </div>

      <PanneauGrid
        items={shown}
        emptyMessage="Aucun panneau ne correspond. Essayez un autre code ou mot-clé."
      />

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setVisible((n) => n + PAGE_SIZE)}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300"
          >
            Afficher plus ({Math.min(PAGE_SIZE, results.length - visible)} de plus)
          </button>
        </div>
      )}
    </div>
  );
}
