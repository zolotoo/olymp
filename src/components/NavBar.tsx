'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { logoutAction } from '@/app/login/actions'

type Item = { href: string; label: string; icon: string }
type Group = { title: string; items: Item[] }

const GROUPS: Group[] = [
  {
    title: 'Люди',
    items: [
      { href: '/',           label: 'Участники',  icon: '👥' },
      { href: '/stats',      label: 'Статистика', icon: '📊' },
      { href: '/audience',   label: 'Аудитория',  icon: '🎯' },
      { href: '/insights',   label: 'AI-инсайты', icon: '🧠' },
      { href: '/broadcasts', label: 'Рассылки',   icon: '📣' },
    ],
  },
  {
    title: 'Контент',
    items: [
      { href: '/texts',   label: 'Тексты',     icon: '📝' },
      { href: '/feed',    label: 'Лента',      icon: '🗞️' },
      { href: '/library', label: 'Библиотека', icon: '📚' },
      { href: '/digest',  label: 'Дайджест',   icon: '📰' },
    ],
  },
  {
    title: 'Механики',
    items: [
      { href: '/flow',    label: 'Дерево сообщений', icon: '🌳' },
      { href: '/bonuses', label: 'Бонусы',           icon: '🎁' },
      { href: '/wheel',   label: 'Колесо',           icon: '🎡' },
      { href: '/kiosk',   label: 'Киоск',            icon: '🛍️' },
      { href: '/ranks',   label: 'Титулы',           icon: '🏅' },
    ],
  },
]

function NavLinks({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <>
      {GROUPS.map(g => (
        <div key={g.title} className="sb-group">
          <div className="sb-group-title">{g.title}</div>
          {g.items.map(it => (
            <Link
              key={it.href}
              href={it.href}
              onClick={onNavigate}
              className={`sb-link${path === it.href ? ' active' : ''}`}
            >
              <span className="sb-icon">{it.icon}</span>
              <span className="sb-label">{it.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </>
  )
}

export default function NavBar() {
  const path = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [path])
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      {/* Mobile top bar */}
      <header className="mobile-topbar md:hidden">
        <button
          aria-label="Меню"
          className="mobile-burger"
          onClick={() => setOpen(true)}
        >
          <span /><span /><span />
        </button>
        <Link href="/" className="mobile-logo">
          <span style={{ fontSize: 18, lineHeight: 1 }}>🏆</span>
          <span>AI&nbsp;Олимп</span>
        </Link>
        <span style={{ width: 36 }} />
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="mobile-drawer-overlay md:hidden" onClick={() => setOpen(false)}>
          <aside className="mobile-drawer" onClick={e => e.stopPropagation()}>
            <div className="sb-header">
              <span style={{ fontSize: 20, lineHeight: 1 }}>🏆</span>
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.5px' }}>AI Олимп</span>
              <button
                aria-label="Закрыть"
                className="mobile-close"
                onClick={() => setOpen(false)}
              >×</button>
            </div>
            <nav className="sb-nav">
              <NavLinks path={path} onNavigate={() => setOpen(false)} />
            </nav>
            <form action={logoutAction} className="sb-footer">
              <button type="submit" className="sb-link sb-logout">
                <span className="sb-icon">↩︎</span>
                <span className="sb-label">Выйти</span>
              </button>
            </form>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sidebar hidden md:flex">
        <Link href="/" className="sb-header">
          <span style={{ fontSize: 22, lineHeight: 1 }}>🏆</span>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.5px', color: '#1C1C1E' }}>
            AI&nbsp;Олимп
          </span>
        </Link>
        <nav className="sb-nav">
          <NavLinks path={path} />
        </nav>
        <form action={logoutAction} className="sb-footer">
          <button type="submit" className="sb-link sb-logout">
            <span className="sb-icon">↩︎</span>
            <span className="sb-label">Выйти</span>
          </button>
        </form>
      </aside>
    </>
  )
}
