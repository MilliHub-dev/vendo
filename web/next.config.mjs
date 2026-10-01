/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export -> ./out (host on any static host: Vercel, Netlify, S3, cPanel...)
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
