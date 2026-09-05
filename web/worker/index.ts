/**
 * Cloudflare Worker: SPA assets + R2 images + OG social previews + bot meta.
 */

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
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|SkypeUriPreview|Applebot|Googlebot|bingbot|DuckDuckBot|Slurp|Baiduspider|YandexBot|Embedly|Quora Link Preview|Showyoubot|outbrain|pinterest|redditbot|vkShare|W3C_Validator|flipboard|tumblr|bitlybot|SkypeUriPreview|nuzzel|Discordbot|Qwantify|pinterestbot|Bitrix link preview|XING-contenttabreceiver|Chrome-Lighthouse|Viber|Yahoo! Slurp/i;

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
};

let catalogCache: Catalog | null = null;

async function loadCatalog(env: Env, origin: string): Promise<Catalog> {
  if (catalogCache) return catalogCache;
  // Slim catalog shipped as static asset (web/public/panneaux-catalog.json)
  const res = await env.ASSETS.fetch(
    new Request(new URL("/panneaux-catalog.json", origin)),
  );
  if (!res.ok) {
    catalogCache = { panneaux: [], categories: [] };
    return catalogCache;
  }
  const data = (await res.json()) as {
    panneaux?: CatalogPanneau[];
    categories?: CatalogCategory[];
  };
  catalogCache = {
    panneaux: data.panneaux ?? [],
    categories: data.categories ?? [],
  };
  return catalogCache;
}

function codeToSlug(code: string): string {
  return code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function findBySlug(list: CatalogPanneau[], slug: string): CatalogPanneau | undefined {
  const s = slug.toLowerCase();
  return (
    list.find((p) => codeToSlug(p.code) === s) ||
    list.find((p) => String(p.cid) === s)
  );
}

function findCategoryBySlug(
  slug: string,
  nodes: CatalogCategory[] = [],
): CatalogCategory | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const child = findCategoryBySlug(slug, node.children ?? []);
    if (child) return child;
  }
  return undefined;
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
  const leafCats = collectCats(node);
  return list.filter((p) => p.category?.cat != null && leafCats.has(p.category.cat));
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
      const label = `${escHtml(n.nameFr)}`;
      const kids = n.children?.length ? categoryTreeHtml(n.children, origin) : "";
      return `<li><a href="${href}">${label}</a>${kids}</li>`;
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
  key: string,
  fallbackKeys: string[] = [],
): Promise<Response | null> {
  if (!env.IMAGES) return null;
  const keys = [key, ...fallbackKeys];
  for (const k of keys) {
    const object = await env.IMAGES.get(k);
    if (!object) continue;
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=86400");
    if (!headers.has("content-type")) {
      headers.set("content-type", "image/png");
    }
    return new Response(object.body, { headers });
  }
  return null;
}

function defaultOg(origin: string): string {
  return `${origin}/og.png`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const ua = request.headers.get("user-agent") || "";

    // --- Raw panneau images from R2 ---
    if (pathname.startsWith(IMAGE_PREFIX) && env.IMAGES) {
      const key = decodeURIComponent(pathname.slice(IMAGE_PREFIX.length));
      if (!key || key.includes("..")) {
        return new Response("Not found", { status: 404 });
      }
      const res = await serveR2Image(env, key, [`${key}.png`, `images/${key}`]);
      return res ?? new Response("Image not found", { status: 404 });
    }

    // --- Open Graph branded cards: /og/{cid}.png or /og/{cid} ---
    if (pathname.startsWith(OG_PREFIX) && env.IMAGES) {
      const raw = decodeURIComponent(pathname.slice(OG_PREFIX.length)).replace(
        /\.png$/i,
        "",
      );
      if (!raw || raw.includes("..") || !/^\d+$/.test(raw)) {
        return new Response("Not found", { status: 404 });
      }
      // Prefer pre-generated branded card; fall back to raw sign image
      const res = await serveR2Image(env, `og/${raw}`, [raw, `${raw}.png`]);
      if (res) {
        const headers = new Headers(res.headers);
        headers.set("cache-control", "public, max-age=604800");
        return new Response(res.body, { status: res.status, headers });
      }
      return new Response("OG image not found", { status: 404 });
    }

    // --- Search / social crawlers: crawlable HTML + OG tags ---
    if (BOT_UA.test(ua)) {
      const catalog = await loadCatalog(env, url.origin);
      const og = defaultOg(url.origin);

      if (pathname === "/" || pathname === "") {
        const links = catalog.categories
          .map((c) => {
            const href = escHtml(`${url.origin}/categorie/${c.slug}`);
            return `<li><a href="${href}">${escHtml(c.nameFr)}</a></li>`;
          })
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
        const slug = decodeURIComponent(catMatch[1]!);
        const node = findCategoryBySlug(slug, catalog.categories);
        if (node) {
          const items = panneauxInCategory(node, catalog.panneaux);
          const shown = items.slice(0, PANNEAU_LINK_CAP);
          const childLinks = (node.children ?? [])
            .map((c) => {
              const href = escHtml(`${url.origin}/categorie/${c.slug}`);
              return `<li><a href="${href}">${escHtml(c.nameFr)}</a></li>`;
            })
            .join("");
          const panneauLinks = shown
            .map((p) => {
              const href = escHtml(`${url.origin}/panneau/${codeToSlug(p.code)}`);
              const label = escHtml(`${p.code} — ${p.nameFr}`);
              return `<li><a href="${href}">${label}</a></li>`;
            })
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
        const slug = decodeURIComponent(panneauMatch[1]!);
        const p = findBySlug(catalog.panneaux, slug);
        if (p) {
          const title = `${p.code} — ${p.nameFr} · Panneaux QC`;
          const description = (
            p.descriptionFr ||
            `Panneau de signalisation ${p.code} — ${p.nameFr}. Signalisation routière du Québec.`
          ).slice(0, 300);
          const pageUrl = `${url.origin}/panneau/${codeToSlug(p.code)}`;
          const image = `${url.origin}/og/${p.cid}.png`;
          const topLabel = p.category?.pathFr?.[0];
          const topCat = topLabel
            ? catalog.categories.find(
                (c) => c.nameFr === topLabel || c.slug === topLabel.toLowerCase(),
              )
            : undefined;
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
