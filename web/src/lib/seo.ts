/** URL canonique du site (prod). Surcharge : VITE_SITE_URL */
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || "https://panneaux.quebec"
).replace(/\/$/, "");

export const SITE_NAME = "Panneaux QC";

export const DEFAULT_DESCRIPTION =
  "Consultez et recherchez les panneaux de signalisation routière du Québec : danger, prescription, travaux, indication et panonceaux. Répertoire visuel non officiel basé sur le RSR (MTMD).";

export const DEFAULT_TITLE =
  "Panneaux QC — Signalisation routière du Québec";

export type SeoInput = {
  title?: string;
  description?: string;
  /** Path only, e.g. /panneau/p-70-1 */
  path?: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function setJsonLd(data: Record<string, unknown> | Record<string, unknown>[]) {
  const id = "seo-jsonld";
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/** Met à jour title, meta et JSON-LD (côté client). */
export function applySeo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image,
  type = "website",
  noindex = false,
  jsonLd,
}: SeoInput) {
  const fullTitle =
    !title || title === DEFAULT_TITLE
      ? DEFAULT_TITLE
      : title.includes(SITE_NAME)
        ? title
        : `${title} · ${SITE_NAME}`;

  document.title = fullTitle;

  const url = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const ogImage = image?.startsWith("http")
    ? image
    : image
      ? `${SITE_URL}${image.startsWith("/") ? image : `/${image}`}`
      : `${SITE_URL}/og.png`;

  setMeta("name", "description", description);
  setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
  setMeta("property", "og:title", fullTitle);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", url);
  setMeta("property", "og:type", type);
  setMeta("property", "og:site_name", SITE_NAME);
  setMeta("property", "og:locale", "fr_CA");
  setMeta("property", "og:image", ogImage);
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", fullTitle);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", ogImage);
  setLink("canonical", url);

  if (jsonLd) setJsonLd(jsonLd);
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: [
      "Panneaux de signalisation Québec",
      "Signalisation routière Québec",
    ],
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    inLanguage: "fr-CA",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    about: {
      "@type": "Thing",
      name: "Signalisation routière du Québec",
    },
    isAccessibleForFree: true,
  };
}

export function panneauJsonLd(p: {
  code: string;
  nameFr: string;
  descriptionFr?: string;
  path: string;
  image?: string;
  categoryPath: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: `${p.code} — ${p.nameFr}`,
    description:
      p.descriptionFr ||
      `Panneau de signalisation routière ${p.code} (${p.nameFr}) au Québec.`,
    contentUrl: p.image,
    url: `${SITE_URL}${p.path}`,
    inLanguage: "fr-CA",
    keywords: [p.code, p.nameFr, ...p.categoryPath, "signalisation", "Québec"].join(
      ", ",
    ),
    thumbnailUrl: p.image?.startsWith("http")
      ? p.image
      : p.image
        ? `${SITE_URL}${p.image.startsWith("/") ? p.image : `/${p.image}`}`
        : undefined,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

/** Absolute OG card URL for a panneau cid. */
export function absoluteOgUrl(cid: number): string {
  return `${SITE_URL}/og/${cid}.png`;
}
