import type { Metadata, Viewport } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'AI Олимп',
  description: 'Мини-приложение клуба AI Олимп',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ffffff',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div style={{ minHeight: '100vh', background: '#F2F2F7' }}>
        {children}
      </div>
    </>
  )
}
