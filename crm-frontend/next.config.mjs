/** @type {import('next').NextConfig} */

// Backend origin to proxy /api/* requests to. Server-side only (not exposed to
// the browser), so the browser always talks to this same Vercel origin and CORS
// never comes into play.
const BACKEND_URL =
  process.env.BACKEND_URL ?? "https://campaignmind-crm.onrender.com";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
