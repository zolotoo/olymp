import LoginForm from './LoginForm'

export const metadata = { title: 'Вход · AI Олимп' }
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <LoginForm />
    </main>
  )
}
