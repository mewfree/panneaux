/**
 * Cloudflare Worker: SPA assets + R2 images + OG social previews + bot meta.
 */

export interface Env {
  ASSETS: Fetcher;
  IMAGES?: R2Bucket;
}

const IMAGE_PREFIX = "/img/";
const OG_PREFIX = "/og/";

/** Crawlers that need static og: meta (don't run our React SEO). */
const BOT_UA =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|SkypeUriPreview|Applebot|Googlebot|bingbot|DuckDuckBot|Slurp|Baiduspider|YandexBot|Embedly|Quora Link Preview|Showyoubot|outbrain|pinterest|redditbot|vkShare|W3C_Validator|flipboard|tumblr|bitlybot|SkypeUriPreview|nuzzel|Discordbot|Qwantify|pinterestbot|Bitrix link preview|XING-contenttabreceiver|Chrome-Lighthouse|Viber|Yahoo! Slurp/i;

type CatalogPanneau = {
  cid: number;
  code: string;
  nameFr: string;
  descriptionFr?: string;
  imageKey: string;
  category?: { pathFr?: string[] };
};

let catalogCache: CatalogPanneau[] | null = null;

async function loadCatalog(env: Env, origin: string): Promise<CatalogPanneau[]> {
  if (catalogCache) return catalogCache;
  // Slim catalog shipped as static asset (web/public/panneaux-catalog.json)
  const res = await env.ASSETS.fetch(
    new Request(new URL("/panneaux-catalog.json", origin)),
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { panneaux?: CatalogPanneau[] };
  catalogCache = data.panneaux ?? [];
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

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function botHtml(opts: {
  title: string;
  description: string;
  url: string;
  image: string;
  siteName?: string;
}): Response {
  const title = escHtml(opts.title);
  const description = escHtml(opts.description);
  const url = escHtml(opts.url);
  const image = escHtml(opts.image);
  const site = escHtml(opts.siteName ?? "Panneaux QC");

  const html = `<!doctype html>
<html lang="fr-CA">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <meta name="description" content="${description}"/>
  <link rel="canonical" href="${url}"/>
  <meta property="og:type" content="article"/>
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
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
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

    // --- Social crawlers: inject correct OG tags for panneau pages ---
    const panneauMatch = pathname.match(/^\/panneau\/([^/]+)\/?$/);
    if (panneauMatch && BOT_UA.test(ua)) {
      const slug = decodeURIComponent(panneauMatch[1]!);
      const list = await loadCatalog(env, url.origin);
      const p = findBySlug(list, slug);
      if (p) {
        const title = `${p.code} — ${p.nameFr} · Panneaux QC`;
        const description = (
          p.descriptionFr ||
          `Panneau de signalisation ${p.code} — ${p.nameFr}. Signalisation routière du Québec.`
        ).slice(0, 300);
        const pageUrl = `${url.origin}/panneau/${codeToSlug(p.code)}`;
        const image = `${url.origin}/og/${p.cid}.png`;
        return botHtml({ title, description, url: pageUrl, image });
      }
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
