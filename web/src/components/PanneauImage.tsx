import { useState } from "react";

type Props = {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
};

/**
 * Tries primary src (R2 /img/…), then official RSR URL, then a placeholder.
 * Official images may be blocked by CF from some environments — placeholder is fine for UI work.
 */
export function PanneauImage({ src, fallbackSrc, alt, className }: Props) {
  const [stage, setStage] = useState<"primary" | "fallback" | "placeholder">("primary");

  if (stage === "placeholder") {
    return (
      <div
        className={[
          "flex aspect-square w-full max-w-full flex-col items-center justify-center gap-2 rounded-lg bg-slate-100 text-slate-400",
          className,
        ].join(" ")}
        role="img"
        aria-label={alt}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 3l9 16H3L12 3z" />
          <path d="M12 10v4" />
          <circle cx="12" cy="17" r="0.8" fill="currentColor" />
        </svg>
        <span className="px-2 text-center text-xs">{alt}</span>
      </div>
    );
  }

  const current = stage === "primary" ? src : (fallbackSrc ?? src);

  return (
    <img
      src={current}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        if (stage === "primary" && fallbackSrc && fallbackSrc !== src) {
          setStage("fallback");
        } else {
          setStage("placeholder");
        }
      }}
    />
  );
}
