/** @type {import('next').NextConfig} */
const onVercel = !!process.env.VERCEL;
const nextConfig = {
  reactStrictMode: true,
  // Self-hosting (Databricks Apps / Render) runs `next start` off a standalone
  // server. Vercel builds with its own adapter, so don't emit standalone there.
  ...(onVercel ? {} : { output: "standalone" }),
};

module.exports = nextConfig;
