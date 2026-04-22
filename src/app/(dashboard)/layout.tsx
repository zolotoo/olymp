import NavBar from '@/components/NavBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main className="max-w-7xl mx-auto px-6 pt-24 pb-12">
        {children}
      </main>
    </>
  )
}
