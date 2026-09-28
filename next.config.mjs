/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        // Hardcoded to the Docker Compose service name and internal port
        destination: "http://backend:5000/api/:path*", 
      },
      {
        source: "/uploads/:path*",
        destination: "http://backend:5000/uploads/:path*",
      }
    ];
  },
};

export default nextConfig;
