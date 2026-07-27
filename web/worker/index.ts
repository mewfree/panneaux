/**
 * Cloudflare Worker entry: serve SPA assets + optional image proxy from R2.
 */

export interface Env {
  ASSETS: Fetcher;
  IMAGES?: R2Bucket;
}

const IMAGE_PREFIX = "/img/";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith(IMAGE_PREFIX) && env.IMAGES) {
      const key = decodeURIComponent(url.pathname.slice(IMAGE_PREFIX.length));
      if (!key || key.includes("..")) {
        return new Response("Not found", { status: 404 });
      }

      const object = await env.IMAGES.get(key);
      if (!object) {
        return new Response("Image not found", { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("cache-control", "public, max-age=31536000, immutable");
      if (!headers.has("content-type")) {
        headers.set("content-type", "image/png");
      }

      return new Response(object.body, { headers });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
