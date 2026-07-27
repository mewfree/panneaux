import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FilterChip } from "../components/FilterChip";
import { PanneauGrid } from "../components/PanneauGrid";
import { SearchBox } from "../components/SearchBox";
import { Seo } from "../components/Seo";
import { catalog, countForCategory, topCategories } from "../lib/catalog";
import { searchPanneaux } from "../lib/search";
import { DEFAULT_DESCRIPTION, websiteJsonLd } from "../lib/seo";
import { newShuffleSeed, shuffle } from "../lib/shuffle";

const PAGE_SIZE = 48;
const PREFIXES = ["P-", "D-", "T-", "I-", "Rte-", "Auto-"];

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const catFilter = params.get("cat") ?? "";
  const prefix = params.get("prefix") ?? "";
  const randomOn = params.get("random") === "1";
  const seedParam = params.get("seed");
  const seed = seedParam ? Number(seedParam) : null;
  const [localQ, setLocalQ] = useState(q);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalQ(q);
  }, [q]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [q, catFilter, prefix, randomOn, seed]);

  const results = useMemo(() => {
    const base = searchPanneaux(
      q,
      {
        cats: catFilter ? [catFilter] : undefined,
        codePrefix: prefix || undefined,
      },
      5000,
    );
    if (!randomOn) return base;
    // Stable shuffle when seed is set; otherwise one-shot random (no seed yet)
    return shuffle(base, seed != null && Number.isFinite(seed) ? seed : undefined);
  }, [q, catFilter, prefix, randomOn, seed]);

  const shown = results.slice(0, visible);
  const hasMore = visible < results.length;

  // Infinite scroll: load the next page when the sentinel enters the viewport
  useEffect(() => {
    if (!hasMore) return;
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((n) => Math.min(n + PAGE_SIZE, results.length));
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, results.length, visible]);

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  }

  function enableRandom() {
    update({ random: "1", seed: String(newShuffleSeed()) });
  }

  function reshuffle() {
    update({ random: "1", seed: String(newShuffleSeed()) });
  }

  function disableRandom() {
    update({ random: null, seed: null });
  }

  const filtering = Boolean(q.trim() || catFilter || prefix || randomOn);

  const seoTitle = q.trim()
    ? `Recherche « ${q.trim()} » — panneaux du Québec`
    : catFilter
      ? `Panneaux · ${topCategories.find((c) => c.cat === catFilter)?.nameFr ?? catFilter}`
      : undefined;
  const seoDesc = q.trim()
    ? `${results.length} panneau(x) pour « ${q.trim()} » dans le répertoire de signalisation routière du Québec.`
    : DEFAULT_DESCRIPTION;

  return (
    <div className="space-y-6">
      <Seo
        title={seoTitle}
        description={seoDesc}
        path={
          q || catFilter || prefix || randomOn
            ? `/?${params.toString()}`
            : "/"
        }
        jsonLd={websiteJsonLd()}
      />
      <header className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Panneaux de signalisation routière du Québec
          </h1>
          <p className="text-slate-600">
            {catalog.count.toLocaleString("fr-CA")} panneaux du Québec — cherchez par code
            ou nom (ex. P-70, arrêt, danger), ou parcourez par catégorie.
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
          <span className="mx-1 hidden h-4 w-px bg-slate-200 sm:inline" aria-hidden />
          <FilterChip
            active={randomOn}
            onClick={() => (randomOn ? disableRandom() : enableRandom())}
            label="Aléatoire"
          />
          {randomOn && (
            <button
              type="button"
              onClick={reshuffle}
              className="cursor-pointer text-xs font-medium text-brand-600 hover:underline"
            >
              Mélanger à nouveau
            </button>
          )}
          {filtering && (
            <button
              type="button"
              className="ml-1 cursor-pointer text-xs font-medium text-brand-600 hover:underline"
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
          {randomOn ? (
            <span className="text-slate-400"> · ordre aléatoire</span>
          ) : null}
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
        <div
          ref={loadMoreRef}
          className="flex justify-center py-6"
          aria-hidden
        >
          <span className="text-sm text-slate-400">Chargement…</span>
        </div>
      )}
    </div>
  );
}
