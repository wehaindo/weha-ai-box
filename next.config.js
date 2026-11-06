/** @type {import('next').NextConfig} */
const runtimeUrl = process.env.RUNTIME_URL || 'http://127.0.0.1:4000'

const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/runtime/:path*',
        destination: `${runtimeUrl}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
