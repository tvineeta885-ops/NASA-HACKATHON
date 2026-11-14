import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'
import { maxFileBytes } from './contract'

const apiOrigin = (process.env.FIRE_ATLAS_API_ORIGIN || 'http://127.0.0.1:8787').replace(/\/$/, '')

const config: NextConfig = {
  basePath: '/fire-atlas',
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
  agentRules: false,
  experimental: { proxyClientMaxBodySize: 2 * maxFileBytes + 16_384 },
  async rewrites() {
    return [{ source: '/api/fire-atlas/:path*', destination: `${apiOrigin}/api/fire-atlas/:path*` }]
  },
}

export default config
