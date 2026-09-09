const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1', port: '5000' },
      { protocol: 'http', hostname: 'localhost', port: '5000' },
      { protocol: 'http', hostname: 'backend', port: '5000' }
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;