import type { Panneau } from "../lib/types";
import { PanneauCard } from "./PanneauCard";

type Props = {
  items: Panneau[];
  emptyMessage?: string;
};

export function PanneauGrid({
  items,
  emptyMessage = "Aucun panneau trouvé.",
}: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((p) => (
        <li key={p.cid}>
          <PanneauCard panneau={p} />
        </li>
      ))}
    </ul>
  );
}
