/** @type {import('next').NextConfig} */
const nextConfig = {
  // Electron loads the Next.js dev server via http://localhost:3111
  // For production builds we serve the .next output via a local express server
  // or use next start inside the Electron main process.
  assetPrefix: process.env.NODE_ENV === 'production' ? '.' : undefined,

  // Allow cross-origin requests from Electron renderer
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
