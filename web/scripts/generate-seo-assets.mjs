/**
 * Génère robots.txt + sitemap.xml dans public/ à partir du catalogue.
 * Exécuté avant le build Vite.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const publicDir = path.resolve(__dirname, "../public");
const catalogPath = path.join(root, "data/panneaux.json");
const categoriesPath = path.join(root, "data/categories.json");

const SITE = (process.env.VITE_SITE_URL || "https://panneaux.quebec").replace(
  /\/$/,
  "",
);

function codeToSlug(code) {
  return code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function collectCategorySlugs(nodes, acc = []) {
  for (const n of nodes) {
    acc.push(n.slug);
    if (n.children?.length) collectCategorySlugs(n.children, acc);
  }
  return acc;
}

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const categories = JSON.parse(fs.readFileSync(categoriesPath, "utf8"));
const catSlugs = collectCategorySlugs(categories.categories ?? []);

// Dedupe slugs (same code → same URL)
const panneauPaths = [
  ...new Set(
    (catalog.panneaux ?? []).map((p) => `/panneau/${codeToSlug(p.code)}`),
  ),
];

const urls = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/categories", priority: "0.8", changefreq: "monthly" },
  ...catSlugs.map((slug) => ({
    loc: `/categorie/${slug}`,
    priority: "0.7",
    changefreq: "monthly",
  })),
  ...panneauPaths.map((loc) => ({
    loc,
    priority: "0.6",
    changefreq: "monthly",
  })),
];

const lastmod = (catalog.scrapedAt || new Date().toISOString()).slice(0, 10);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${esc(SITE + u.loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemap, "utf8");
fs.writeFileSync(path.join(publicDir, "robots.txt"), robots, "utf8");

console.log(
  `SEO assets: ${urls.length} URLs → public/sitemap.xml, robots.txt (${SITE})`,
);
