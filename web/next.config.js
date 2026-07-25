/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Databricks Apps serve behind a proxy; keep output standalone-friendly.
  output: "standalone",
};

module.exports = nextConfig;
