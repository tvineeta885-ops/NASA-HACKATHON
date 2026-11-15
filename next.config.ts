import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'
import { maxFileBytes } from './contract'

const defaultApiOrigin = process.env.NODE_ENV === 'production'
  ? 'https://fire-atlas-api-production.up.railway.app'
  : 'http://127.0.0.1:8787'
const apiOrigin = (process.env.FIRE_ATLAS_API_ORIGIN || defaultApiOrigin).replace(/\/$/, '')

const config: NextConfig = {
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
  agentRules: false,
  experimental: { proxyClientMaxBodySize: 2 * maxFileBytes + 16_384 },
  async redirects() {
    return [{ source: '/fire-atlas', destination: '/', permanent: true }]
  },
  async rewrites() {
    const destination = `${apiOrigin}/api/fire-atlas/:path*`
    return [
      { source: '/api/fire-atlas/:path*', destination },
      { source: '/fire-atlas/api/fire-atlas/:path*', destination },
    ]
  },
}

export default config
