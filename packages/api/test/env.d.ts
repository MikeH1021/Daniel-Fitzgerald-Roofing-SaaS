declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
    LOGOS_BUCKET: R2Bucket;
  }
}
