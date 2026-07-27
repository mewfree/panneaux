import { Link } from "react-router-dom";
import { imageUrl, officialImageFallback, panneauPath } from "../lib/catalog";
import type { Panneau } from "../lib/types";
import { PanneauImage } from "./PanneauImage";

type Props = {
  panneau: Panneau;
};

export function PanneauCard({ panneau }: Props) {
  return (
    <Link
      to={panneauPath(panneau)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex aspect-square items-center justify-center bg-slate-50 p-4">
        <PanneauImage
          src={imageUrl(panneau)}
          fallbackSrc={officialImageFallback(panneau)}
          alt={panneau.nameFr}
          className="max-h-full max-w-full object-contain transition group-hover:scale-[1.02]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t border-slate-100 p-3.5">
        <span className="font-mono text-xs font-semibold tracking-wide text-brand-600">
          {panneau.code}
        </span>
        <span className="line-clamp-2 text-sm font-medium leading-snug text-slate-900">
          {panneau.nameFr}
        </span>
        <span className="mt-auto pt-1 text-xs text-slate-500">
          {panneau.category.pathFr.join(" · ")}
        </span>
      </div>
    </Link>
  );
}
