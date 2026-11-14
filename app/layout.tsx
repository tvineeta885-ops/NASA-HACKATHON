import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '../style.css'

export const metadata: Metadata = {
  title: 'Fire Atlas — Burning Activity Explorer',
  description: 'Explore historical burning activity from NASA FIRMS MODIS and VIIRS observations.',
}

export const viewport: Viewport = { themeColor: '#101923' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
