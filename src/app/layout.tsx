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
        {/* iOS-style top navigation bar */}
        <nav
          className="sticky top-0 z-50 px-6 py-0 border-b"
          style={{
            background: 'rgba(242, 242, 247, 0.82)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderColor: 'rgba(198, 198, 200, 0.5)',
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏛️</span>
              <span
                className="text-base font-semibold tracking-tight"
                style={{ color: '#1D1D1F', letterSpacing: '-0.3px' }}
              >
                AI Олимп
              </span>
            </div>
            <div className="flex items-center gap-1">
              <NavLink href="/" label="Участники" />
              <NavLink href="/flow" label="Сообщения" />
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

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
      style={{ color: '#0A84FF' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(10, 132, 255, 0.08)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {label}
    </a>
  )
}
