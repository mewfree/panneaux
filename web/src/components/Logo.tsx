/** Marque : panneau d’indication sur poteau (bleu MTQ-ish, sobre). */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="32" height="32" rx="8" className="fill-slate-900" />
      <rect x="14.5" y="22" width="3" height="5" rx="0.5" className="fill-slate-400" />
      <rect x="7" y="6" width="18" height="16" rx="3" className="fill-blue-700" />
      <rect
        x="8.5"
        y="7.5"
        width="15"
        height="13"
        rx="2"
        className="stroke-blue-300/50"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M16 10v8M16 10l-3.5 3.5M16 10l3.5 3.5"
        className="stroke-white"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
