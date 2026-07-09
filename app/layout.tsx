import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'site drop',
  description: 'Publish a static folder to a subdomain.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <div className="aurora" aria-hidden />
        {children}
      </body>
    </html>
  )
}
