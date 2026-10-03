/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      // /api rewrite DIBUANG. Guna src/app/api/[...proxy]/route.js
      {
        source: "/uploads/:path*",
        destination: "http://backend:5000/uploads/:path*",
      }
    ];
  },
};

export default nextConfig;