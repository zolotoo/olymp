'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAction } from '@/app/login/actions'

const LINKS = [
  { href: '/',        label: 'Участники' },
  { href: '/flow',    label: 'Дерево сообщений' },
  { href: '/ranks',   label: 'Титулы' },
  { href: '/bonuses', label: 'Бонусы' },
  { href: '/wheel',   label: 'Колесо' },
  { href: '/kiosk',   label: 'Киоск' },
  { href: '/texts',   label: 'Тексты' },
  { href: '/feed',    label: 'Лента' },
  { href: '/audience', label: 'Аудитория' },
  { href: '/broadcasts', label: 'Рассылки' },
]

export default function NavBar() {
  const path = usePathname()
  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="float-nav rounded-full flex items-center gap-0.5 px-2 py-1.5 flex-nowrap whitespace-nowrap">
        <Link href="/" className="flex items-center gap-2 px-3 mr-2" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>🏆</span>
          <span style={{ color: '#1C1C1E', fontSize: 14, fontWeight: 600, letterSpacing: '-0.5px', lineHeight: 1, whiteSpace: 'nowrap' }}>
            AI&nbsp;Олимп
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
        <form action={logoutAction} className="ml-1">
          <button
            type="submit"
            className="nav-link"
            style={{ color: '#FF3B30', background: 'transparent', border: 'none', cursor: 'pointer' }}
            title="Выйти"
          >
            Выйти
          </button>
        </form>
      </div>
    </nav>
  )
}
