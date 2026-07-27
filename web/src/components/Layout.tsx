import { Link, NavLink, Outlet } from "react-router-dom";
import { catalog } from "../lib/catalog";

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-slate-900 text-white"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  ].join(" ");

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-yellow-400"
              aria-hidden
            >
              ▲
            </span>
            <span>
              Panneaux <span className="text-slate-500">QC</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Navigation principale">
            <NavLink to="/" end className={navClass}>
              Explorer
            </NavLink>
            <NavLink to="/categories" className={navClass}>
              Catégories
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-sm text-slate-500 sm:px-6">
          <p>
            <strong className="font-medium text-slate-700">Non officiel.</strong> Données
            issues du{" "}
            <a
              className="text-brand-600 underline-offset-2 hover:underline"
              href="https://www.rsr.transports.gouv.qc.ca/"
              rel="noopener noreferrer"
              target="_blank"
            >
              Répertoire des dispositifs de signalisation routière
            </a>{" "}
            (MTMD). Pour toute référence réglementaire, consultez le site officiel et le
            Tome V.
          </p>
          <p className="text-xs">
            Catalogue : {catalog.count.toLocaleString("fr-CA")} panneaux · mis à jour{" "}
            {new Date(catalog.scrapedAt).toLocaleDateString("fr-CA")}
          </p>
        </div>
      </footer>
    </div>
  );
}
