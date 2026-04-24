import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { getCurrentAdminTgId } from '@/lib/admin-auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth: middleware already checks cookie presence; here we
  // validate the session against the database.
  const tgId = await getCurrentAdminTgId()
  if (!tgId) redirect('/login')

  return (
    <>
      <NavBar />
      <main className="max-w-7xl mx-auto px-6 pt-24 pb-12">
        {children}
      </main>
    </>
  )
}
