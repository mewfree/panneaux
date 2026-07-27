import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PanneauGrid } from "../components/PanneauGrid";
import { SearchBox } from "../components/SearchBox";
import { topCategories } from "../lib/catalog";
import { searchPanneaux } from "../lib/search";

const PREFIXES = ["P-", "D-", "T-", "I-", "Rte-"];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const catFilter = params.get("cat") ?? "";
  const prefix = params.get("prefix") ?? "";
  const devisOnly = params.get("devis") === "1";

  const [localQ, setLocalQ] = useState(q);

  const results = useMemo(
    () =>
      searchPanneaux(
        q,
        {
          cats: catFilter ? [catFilter] : undefined,
          codePrefix: prefix || undefined,
          hasDevis: devisOnly || undefined,
        },
        200,
      ),
    [q, catFilter, prefix, devisOnly],
  );

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Recherche</h1>
        <p className="text-slate-600">
          Recherche instantanée par code, nom ou description.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: localQ });
        }}
        className="space-y-4"
      >
        <SearchBox
          value={localQ}
          onChange={(v) => {
            setLocalQ(v);
            update({ q: v });
          }}
          autoFocus
        />

        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={!catFilter}
            onClick={() => update({ cat: null })}
            label="Toutes catégories"
          />
          {topCategories.map((c) => (
            <FilterChip
              key={c.cat}
              active={catFilter === c.cat}
              onClick={() => update({ cat: catFilter === c.cat ? null : c.cat })}
              label={c.nameFr}
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
          <FilterChip
            active={devisOnly}
            onClick={() => update({ devis: devisOnly ? null : "1" })}
            label="Avec devis"
          />
        </div>
      </form>

      <p className="text-sm text-slate-500">
        {results.length} résultat{results.length === 1 ? "" : "s"}
        {q ? (
          <>
            {" "}
            pour « <span className="font-medium text-slate-700">{q}</span> »
          </>
        ) : null}
      </p>

      <PanneauGrid items={results} emptyMessage="Aucun panneau ne correspond à cette recherche." />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
