// Ambient Env for Cloudflare Vite plugin / wrangler types.
// R2 binding is optional until the bucket is provisioned.
interface Env {
  ASSETS: Fetcher;
  IMAGES?: R2Bucket;
}
