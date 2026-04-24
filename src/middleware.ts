import { NextResponse, type NextRequest } from 'next/server'

const COOKIE_NAME = 'admin_session'

// Public paths inside the matcher's catch-all (the matcher itself excludes
// /api, /app, /login, _next, favicon).
// Everything else under the dashboard route group requires admin session.
//
// We do a lightweight cookie-presence check here; the dashboard server layout
// re-validates the session against the database (Node runtime).
export function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (token && token.length >= 16) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    // Match everything except the listed prefixes.
    '/((?!api|app|login|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
