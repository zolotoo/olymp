import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['*'] },
  },
  async headers() {
    return [
      {
        source: '/app',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
