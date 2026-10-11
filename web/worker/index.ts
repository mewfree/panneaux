/**
 * Cloudflare Worker: SPA assets + R2 images + OG social previews + bot meta.
 */

import { codeToSlug } from "../../data/types";

export interface Env {
  ASSETS: Fetcher;
  IMAGES?: R2Bucket;
}

const IMAGE_PREFIX = "/img/";
const OG_PREFIX = "/og/";
const SITE_NAME = "Panneaux QC";
const DEFAULT_TITLE = "Panneaux QC — Signalisation routière du Québec";
const DEFAULT_DESCRIPTION =
  "Consultez et recherchez les panneaux de signalisation routière du Québec : danger, prescription, travaux, indication et panonceaux. Répertoire visuel non officiel basé sur le RSR (MTMD).";
const CATEGORIES_TITLE = "Catégories de panneaux de signalisation du Québec";
const CATEGORIES_DESCRIPTION =
  "Parcourez les catégories de signalisation routière du Québec : danger, prescription, travaux, indication, panonceaux — hiérarchie du répertoire RSR.";
const PANNEAU_LINK_CAP = 500;

/** Crawlers that need static og: meta (don't run our React SEO). */
const BOT_UA =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Applebot|Googlebot|bingbot|DuckDuckBot|Slurp|Baiduspider|YandexBot|Embedly|Quora Link Preview|Showyoubot|outbrain|pinterest|redditbot|vkShare|W3C_Validator|flipboard|tumblr|bitlybot|nuzzel|Qwantify|Bitrix link preview|XING-contenttabreceiver|Chrome-Lighthouse|Viber/i;

type CatalogCategory = {
  cat: string;
  che: string;
  slug: string;
  nameFr: string;
  nameEn?: string;
  descriptionFr?: string;
  children?: CatalogCategory[];
};

type CatalogPanneau = {
  cid: number;
  code: string;
  nameFr: string;
  descriptionFr?: string;
  imageKey: string;
  category?: { pathFr?: string[]; cat?: string; che?: string };
};

type Catalog = {
  panneaux: CatalogPanneau[];
  categories: CatalogCategory[];
  /** codeToSlug(code) → panneau, plus String(cid) as fallback key. */
  bySlug: Map<string, CatalogPanneau>;
  categoryBySlug: Map<string, CatalogCategory>;
};

function buildCatalog(
  panneaux: CatalogPanneau[],
  categories: CatalogCategory[],
): Catalog {
  const bySlug = new Map<string, CatalogPanneau>();
  for (const p of panneaux) {
    const slug = codeToSlug(p.code);
    if (!bySlug.has(slug)) bySlug.set(slug, p);
  }
  for (const p of panneaux) {
    const cid = String(p.cid);
    if (!bySlug.has(cid)) bySlug.set(cid, p);
  }

  const categoryBySlug = new Map<string, CatalogCategory>();
  const walk = (nodes: CatalogCategory[]) => {
    for (const n of nodes) {
      categoryBySlug.set(n.slug, n);
      walk(n.children ?? []);
    }
  };
  walk(categories);

  return { panneaux, categories, bySlug, categoryBySlug };
}

let catalogPromise: Promise<Catalog> | null = null;

function loadCatalog(env: Env, origin: string): Promise<Catalog> {
  // Slim catalog shipped as static asset (web/public/panneaux-catalog.json).
  // Cache the promise so concurrent cold requests share one fetch; a failure
  // yields an empty catalog for this request only and is retried next time.
  catalogPromise ??= (async () => {
    const res = await env.ASSETS.fetch(
      new Request(new URL("/panneaux-catalog.json", origin)),
    );
    if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`);
    const data = (await res.json()) as {
      panneaux?: CatalogPanneau[];
      categories?: CatalogCategory[];
    };
    return buildCatalog(data.panneaux ?? [], data.categories ?? []);
  })().catch(() => {
    catalogPromise = null;
    return buildCatalog([], []);
  });
  return catalogPromise;
}

function collectCats(node: CatalogCategory, acc = new Set<string>()): Set<string> {
  acc.add(node.cat);
  for (const child of node.children ?? []) collectCats(child, acc);
  return acc;
}

function panneauxInCategory(
  node: CatalogCategory,
  list: CatalogPanneau[],
): CatalogPanneau[] {
  const cats = collectCats(node);
  return list.filter((p) => p.category?.cat != null && cats.has(p.category.cat));
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listItemLink(href: string, label: string): string {
  return `<li><a href="${escHtml(href)}">${escHtml(label)}</a></li>`;
}

function jsonLdScript(data: unknown): string {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function websiteJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: [
      "Panneaux de signalisation Québec",
      "Signalisation routière Québec",
    ],
    url: origin,
    description: DEFAULT_DESCRIPTION,
    inLanguage: "fr-CA",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/?q={search_term_string}`,
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

function panneauJsonLd(
  p: CatalogPanneau,
  pageUrl: string,
  image: string,
  origin: string,
) {
  const pathFr = p.category?.pathFr ?? [];
  return {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: `${p.code} — ${p.nameFr}`,
    description:
      p.descriptionFr ||
      `Panneau de signalisation routière ${p.code} (${p.nameFr}) au Québec.`,
    contentUrl: image,
    url: pageUrl,
    inLanguage: "fr-CA",
    keywords: [p.code, p.nameFr, ...pathFr, "signalisation", "Québec"].join(", "),
    thumbnailUrl: image,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: origin,
    },
  };
}

function categoryTreeHtml(nodes: CatalogCategory[], origin: string): string {
  if (!nodes.length) return "";
  const items = nodes
    .map((n) => {
      const href = escHtml(`${origin}/categorie/${n.slug}`);
      const kids = n.children?.length ? categoryTreeHtml(n.children, origin) : "";
      return `<li><a href="${href}">${escHtml(n.nameFr)}</a>${kids}</li>`;
    })
    .join("");
  return `<ul>${items}</ul>`;
}

function botHtml(opts: {
  title: string;
  description: string;
  url: string;
  image: string;
  siteName?: string;
  type?: "website" | "article";
  body?: string;
  jsonLd?: unknown;
}): Response {
  const title = escHtml(opts.title);
  const description = escHtml(opts.description);
  const url = escHtml(opts.url);
  const image = escHtml(opts.image);
  const site = escHtml(opts.siteName ?? SITE_NAME);
  const type = opts.type ?? "article";
  const extra = opts.body ?? "";
  const ld = opts.jsonLd ? jsonLdScript(opts.jsonLd) : "";

  const html = `<!doctype html>
<html lang="fr-CA">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <meta name="description" content="${description}"/>
  <link rel="canonical" href="${url}"/>
  <meta property="og:type" content="${type}"/>
  <meta property="og:site_name" content="${site}"/>
  <meta property="og:locale" content="fr_CA"/>
  <meta property="og:title" content="${title}"/>
  <meta property="og:description" content="${description}"/>
  <meta property="og:url" content="${url}"/>
  <meta property="og:image" content="${image}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${title}"/>
  <meta name="twitter:description" content="${description}"/>
  <meta name="twitter:image" content="${image}"/>
  ${ld}
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  ${extra}
  <p><a href="${url}">Voir sur Panneaux QC</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

async function serveR2Image(
  env: Env,
  keys: string[],
  cacheControl = "public, max-age=86400",
): Promise<Response | null> {
  if (!env.IMAGES) return null;
  for (const k of keys) {
    const object = await env.IMAGES.get(k);
    if (!object) continue;
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", cacheControl);
    if (!headers.has("content-type")) {
      headers.set("content-type", "image/png");
    }
    return new Response(object.body, { headers });
  }
  return null;
}

/** decodeURIComponent that returns null on malformed input instead of throwing. */
function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

const notFound = (msg = "Not found") => new Response(msg, { status: 404 });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const ua = request.headers.get("user-agent") || "";

    // --- Raw panneau images from R2 ---
    if (pathname.startsWith(IMAGE_PREFIX) && env.IMAGES) {
      const key = safeDecode(pathname.slice(IMAGE_PREFIX.length));
      if (!key || key.includes("..")) return notFound();
      const res = await serveR2Image(env, [key, `${key}.png`, `images/${key}`]);
      return res ?? notFound("Image not found");
    }

    // --- Open Graph branded cards: /og/{cid}.png or /og/{cid} ---
    if (pathname.startsWith(OG_PREFIX) && env.IMAGES) {
      const cid = pathname.slice(OG_PREFIX.length).replace(/\.png$/i, "");
      if (!/^\d+$/.test(cid)) return notFound();
      // Prefer pre-generated branded card; fall back to raw sign image
      const res = await serveR2Image(
        env,
        [`og/${cid}`, cid, `${cid}.png`],
        "public, max-age=604800",
      );
      return res ?? notFound("OG image not found");
    }

    // --- Search / social crawlers: crawlable HTML + OG tags ---
    if (BOT_UA.test(ua)) {
      const catalog = await loadCatalog(env, url.origin);
      const og = `${url.origin}/og.png`;

      if (pathname === "/" || pathname === "") {
        const links = catalog.categories
          .map((c) => listItemLink(`${url.origin}/categorie/${c.slug}`, c.nameFr))
          .join("");
        const body = `<nav>
  <p>Catégories :</p>
  <ul>${links}</ul>
  <p><a href="${escHtml(`${url.origin}/categories`)}">Toutes les catégories</a></p>
</nav>`;
        return botHtml({
          title: DEFAULT_TITLE,
          description: DEFAULT_DESCRIPTION,
          url: `${url.origin}/`,
          image: og,
          type: "website",
          body,
          jsonLd: websiteJsonLd(url.origin),
        });
      }

      if (pathname === "/categories" || pathname === "/categories/") {
        const body = `<nav>${categoryTreeHtml(catalog.categories, url.origin)}</nav>`;
        return botHtml({
          title: CATEGORIES_TITLE,
          description: CATEGORIES_DESCRIPTION,
          url: `${url.origin}/categories`,
          image: og,
          type: "website",
          body,
        });
      }

      const catMatch = pathname.match(/^\/categorie\/([^/]+)\/?$/);
      if (catMatch) {
        const slug = safeDecode(catMatch[1]!);
        const node = slug ? catalog.categoryBySlug.get(slug) : undefined;
        if (node) {
          const items = panneauxInCategory(node, catalog.panneaux);
          const shown = items.slice(0, PANNEAU_LINK_CAP);
          const childLinks = (node.children ?? [])
            .map((c) => listItemLink(`${url.origin}/categorie/${c.slug}`, c.nameFr))
            .join("");
          const panneauLinks = shown
            .map((p) =>
              listItemLink(
                `${url.origin}/panneau/${codeToSlug(p.code)}`,
                `${p.code} — ${p.nameFr}`,
              ),
            )
            .join("");
          const truncated =
            items.length > PANNEAU_LINK_CAP
              ? `<p>Liste tronquée : ${shown.length} sur ${items.length} panneaux.</p>`
              : "";
          const childrenBlock = childLinks
            ? `<p>Sous-catégories :</p><ul>${childLinks}</ul>`
            : "";
          const panneauxBlock = panneauLinks
            ? `<p>Panneaux (${items.length}) :</p><ul>${panneauLinks}</ul>${truncated}`
            : "<p>Aucun panneau dans cette catégorie.</p>";
          const description = (
            node.descriptionFr ||
            `Panneaux de signalisation « ${node.nameFr} » au Québec (${items.length} dispositifs).`
          ).slice(0, 300);
          return botHtml({
            title: `${node.nameFr} — panneaux de signalisation Québec`,
            description,
            url: `${url.origin}/categorie/${node.slug}`,
            image: og,
            type: "website",
            body: `${childrenBlock}${panneauxBlock}`,
          });
        }
      }

      const panneauMatch = pathname.match(/^\/panneau\/([^/]+)\/?$/);
      if (panneauMatch) {
        const slug = safeDecode(panneauMatch[1]!)?.toLowerCase();
        const p = slug ? catalog.bySlug.get(slug) : undefined;
        if (p) {
          const title = `${p.code} — ${p.nameFr} · Panneaux QC`;
          const description = (
            p.descriptionFr ||
            `Panneau de signalisation ${p.code} — ${p.nameFr}. Signalisation routière du Québec.`
          ).slice(0, 300);
          const pageUrl = `${url.origin}/panneau/${codeToSlug(p.code)}`;
          const image = `${url.origin}/og/${p.cid}.png`;
          const topCode = p.category?.che?.split("-")[0];
          const topCat = catalog.categories.find((c) => c.cat === topCode);
          const crumbs = [
            `<a href="${escHtml(`${url.origin}/`)}">Accueil</a>`,
            topCat
              ? `<a href="${escHtml(`${url.origin}/categorie/${topCat.slug}`)}">${escHtml(topCat.nameFr)}</a>`
              : null,
            escHtml(p.code),
          ]
            .filter(Boolean)
            .join(" / ");
          return botHtml({
            title,
            description,
            url: pageUrl,
            image,
            body: `<nav aria-label="Fil d'Ariane">${crumbs}</nav>`,
            jsonLd: panneauJsonLd(p, pageUrl, image, url.origin),
          });
        }
      }
    }

    // --- Static SEO assets with explicit content-type + cache ---
    if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
      const res = await env.ASSETS.fetch(request);
      if (res.ok) {
        const headers = new Headers(res.headers);
        headers.set(
          "content-type",
          pathname === "/sitemap.xml" ? "application/xml" : "text/plain",
        );
        headers.set("cache-control", "public, max-age=3600");
        return new Response(res.body, { status: res.status, headers });
      }
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
