import { Link, useParams } from "react-router-dom";
import { PanneauImage } from "../components/PanneauImage";
import { Seo } from "../components/Seo";
import {
  getBySlug,
  imageUrl,
  officialImageFallback,
  ogImageUrl,
  panneauPath,
  topCategoryOf,
} from "../lib/catalog";
import { panneauJsonLd } from "../lib/seo";
import { devisUrl } from "../lib/types";

export function PanneauPage() {
  const { codeSlug = "" } = useParams();
  const p = getBySlug(codeSlug);

  if (!p) {
    return (
      <div className="space-y-4">
        <Seo title="Panneau introuvable" path={`/panneau/${codeSlug}`} noindex />
        <h1 className="text-2xl font-bold">Panneau introuvable</h1>
        <Link to="/" className="text-brand-600 hover:underline">
          ← Retour à l’exploration
        </Link>
      </div>
    );
  }

  const topSlug = topCategoryOf(p)?.slug;
  const facts: { label: string; value: string | number; mono?: boolean }[] = [
    { label: "Identifiant RSR", value: p.cid, mono: true },
    { label: "Devis technique", value: p.hasDevis ? "Disponible" : "Non disponible" },
    ...(p.usage ? [{ label: "Usage", value: p.usage }] : []),
    ...(p.couleur ? [{ label: "Couleur", value: p.couleur }] : []),
    ...(p.pellicule ? [{ label: "Pellicule", value: p.pellicule }] : []),
    ...(p.tomeV ? [{ label: "Tome V", value: p.tomeV, mono: true }] : []),
  ];

  const path = panneauPath(p);
  const og = ogImageUrl(p);
  const description =
    p.descriptionFr ||
    `Panneau de signalisation ${p.code} — ${p.nameFr}. Signalisation routière du Québec (${p.category.pathFr.join(", ")}).`;

  return (
    <article className="space-y-8">
      <Seo
        title={`${p.code} — ${p.nameFr}`}
        description={description.slice(0, 300)}
        path={path}
        image={og}
        type="article"
        jsonLd={panneauJsonLd({
          code: p.code,
          nameFr: p.nameFr,
          descriptionFr: p.descriptionFr,
          path,
          image: og,
          categoryPath: p.category.pathFr,
        })}
      />
      <nav className="text-sm text-slate-500" aria-label="Fil d'Ariane">
        <Link to="/" className="hover:text-slate-800">
          Accueil
        </Link>
        <span className="mx-1.5">/</span>
        {topSlug && (
          <>
            <Link to={`/categorie/${topSlug}`} className="hover:text-slate-800">
              {p.category.pathFr[0]}
            </Link>
            <span className="mx-1.5">/</span>
          </>
        )}
        <span className="text-slate-800">{p.code}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <PanneauImage
            src={imageUrl(p)}
            fallbackSrc={officialImageFallback(p)}
            alt={`${p.code} — ${p.nameFr}`}
            className="max-h-80 max-w-full object-contain"
          />
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="font-mono text-sm font-semibold tracking-wide text-brand-600">
              {p.code}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {p.nameFr}
            </h1>
            <p className="text-sm text-slate-500">
              {p.category.pathFr.join(" · ")}
            </p>
          </div>

          {p.descriptionFr && (
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-800">Description</h2>
              <p className="leading-relaxed text-slate-700">{p.descriptionFr}</p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            {facts.map((f) => (
              <div key={f.label} className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">{f.label}</dt>
                <dd className={f.mono ? "font-mono font-medium" : "font-medium"}>
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>

          {p.hasDevis && (
            <div className="flex flex-wrap gap-3">
              <a
                href={devisUrl(p.cid)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Devis PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
