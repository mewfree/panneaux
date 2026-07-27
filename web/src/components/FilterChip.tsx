type Props = {
  label: string;
  active: boolean;
  onClick: () => void;
};

export function FilterChip({ label, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
