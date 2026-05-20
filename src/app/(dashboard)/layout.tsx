import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { getCurrentAdminTgId } from '@/lib/admin-auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth: middleware already checks cookie presence; here we
  // validate the session against the database.
  const tgId = await getCurrentAdminTgId()
  if (!tgId) redirect('/login')

  return (
    <div className="dk-admin-bg">
      <NavBar />
      <div className="md:pl-[240px]">
        <main className="max-w-7xl mx-auto px-4 md:px-8 pt-[72px] md:pt-8 pb-12">
          {children}
        </main>
      </div>
    </div>
  )
}
