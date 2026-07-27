import { useId } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  size?: "lg" | "md";
};

export function SearchBox({
  value,
  onChange,
  placeholder = "Code, nom ou mot-clé…",
  autoFocus,
  size = "md",
}: Props) {
  const id = useId();
  const pad = size === "lg" ? "px-5 py-4 text-lg" : "px-4 py-2.5 text-base";

  return (
    <div className="relative w-full">
      <label htmlFor={id} className="sr-only">
        Rechercher un panneau
      </label>
      <span
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"
        aria-hidden
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
      </span>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        className={[
          "w-full rounded-xl border border-slate-200 bg-white shadow-sm",
          "placeholder:text-slate-400",
          "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none",
          "pl-11 pr-4",
          pad,
        ].join(" ")}
      />
    </div>
  );
}
