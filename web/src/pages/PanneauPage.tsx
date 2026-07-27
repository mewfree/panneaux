import { Link, useParams } from "react-router-dom";
import { PanneauImage } from "../components/PanneauImage";
import { Seo } from "../components/Seo";
import {
  getBySlug,
  imageUrl,
  officialImageFallback,
  panneauPath,
  topCategories,
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

  const topSlug =
    topCategories.find(
      (c) => c.cat === p.category.cat || p.category.che.startsWith(c.cat),
    )?.slug ?? topCategories[0]?.slug;

  const path = panneauPath(p);
  const img = imageUrl(p);
  const description =
    p.descriptionFr ||
    `Panneau de signalisation ${p.code} — ${p.nameFr}. Signalisation routière du Québec (${p.category.pathFr.join(", ")}).`;

  return (
    <article className="space-y-8">
      <Seo
        title={`${p.code} — ${p.nameFr}`}
        description={description.slice(0, 300)}
        path={path}
        image={img}
        type="article"
        jsonLd={panneauJsonLd({
          code: p.code,
          nameFr: p.nameFr,
          descriptionFr: p.descriptionFr,
          path,
          image: img.startsWith("http") ? img : undefined,
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
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Identifiant RSR</dt>
              <dd className="font-mono font-medium">{p.cid}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Devis technique</dt>
              <dd className="font-medium">{p.hasDevis ? "Disponible" : "Non disponible"}</dd>
            </div>
            {p.usage && (
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Usage</dt>
                <dd className="font-medium">{p.usage}</dd>
              </div>
            )}
            {p.couleur && (
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Couleur</dt>
                <dd className="font-medium">{p.couleur}</dd>
              </div>
            )}
            {p.pellicule && (
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Pellicule</dt>
                <dd className="font-medium">{p.pellicule}</dd>
              </div>
            )}
            {p.tomeV && (
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Tome V</dt>
                <dd className="font-mono font-medium">{p.tomeV}</dd>
              </div>
            )}
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
