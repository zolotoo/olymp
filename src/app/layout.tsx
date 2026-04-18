import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import NavBar from '@/components/NavBar'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'AI Олимп',
  description: 'Дашборд клуба AI Олимп',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={inter.className} style={{ letterSpacing: '-0.1px' }}>
        <NavBar />
        <main className="max-w-7xl mx-auto px-6 pt-24 pb-12">
          {children}
        </main>
      </body>
    </html>
  )
}
