/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/runtime/:path*',
        destination: 'http://127.0.0.1:4000/:path*',
      },
    ]
  },
}

module.exports = nextConfig
