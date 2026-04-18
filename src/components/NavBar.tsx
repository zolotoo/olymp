'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/',        label: 'Участники' },
  { href: '/flow',    label: 'Дерево сообщений' },
  { href: '/ranks',   label: 'Ранги' },
  { href: '/bonuses', label: 'Бонусы' },
]

export default function NavBar() {
  const path = usePathname()
  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="float-nav rounded-full flex items-center gap-0.5 px-2 py-1.5">
        <Link href="/" className="flex items-center gap-2 px-3 mr-2">
          <span style={{ fontSize: 18, lineHeight: 1 }}>🏛️</span>
          <span style={{ color: '#1C1C1E', fontSize: 14, fontWeight: 600, letterSpacing: '-0.5px', lineHeight: 1 }}>
            AI Олимп
          </span>
        </Link>
        {LINKS.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link${path === l.href ? ' active' : ''}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
