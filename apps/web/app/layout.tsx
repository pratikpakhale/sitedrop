import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import type { ReactNode } from 'react'
import { ROOT_DOMAIN } from '@/lib/config'
import './globals.css'

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

const origin = ROOT_DOMAIN.startsWith('localhost') ? `http://${ROOT_DOMAIN}` : `https://${ROOT_DOMAIN}`

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: 'site drop',
  description: 'Drop a folder or a .zip, get a live site on a subdomain.',
  applicationName: 'site drop',
  appleWebApp: { capable: true, title: 'site drop', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    url: origin,
    siteName: 'site drop',
    title: 'site drop',
    description: 'Drop a folder or a .zip, get a live site on a subdomain.',
  },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f9f7f4',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
