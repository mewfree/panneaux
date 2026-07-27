import { useEffect } from "react";
import { applySeo, type SeoInput } from "../lib/seo";

/** Applique les balises SEO à chaque changement de page. */
export function Seo(props: SeoInput) {
  useEffect(() => {
    applySeo(props);
  }, [
    props.title,
    props.description,
    props.path,
    props.image,
    props.type,
    props.noindex,
    // jsonLd identity via stringify is fine for our small objects
    JSON.stringify(props.jsonLd ?? null),
  ]);

  return null;
}
