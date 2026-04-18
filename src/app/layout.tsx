import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'AI Олимп',
  description: 'Дашборд клуба AI Олимп',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <style>{`
          .nav-link {
            color: #0A84FF;
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            text-decoration: none;
            transition: background 0.15s;
          }
          .nav-link:hover {
            background: rgba(10, 132, 255, 0.08);
          }
        `}</style>

        <nav
          className="glass-nav sticky top-0 z-50 px-6 py-0"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏛️</span>
              <span
                className="text-base font-semibold"
                style={{ color: '#1D1D1F', letterSpacing: '-0.3px' }}
              >
                AI Олимп
              </span>
            </div>
            <div className="flex items-center gap-1">
              <a href="/" className="nav-link">Участники</a>
              <a href="/flow" className="nav-link">Дерево сообщений</a>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
