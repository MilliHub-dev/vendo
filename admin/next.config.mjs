/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export -> ./out. The dashboard is a client-side app, so any static host works.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
