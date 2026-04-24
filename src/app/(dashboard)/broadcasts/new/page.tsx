import NewBroadcastForm from './NewBroadcastForm'

export const metadata = { title: 'Новая рассылка · AI Олимп' }
export const dynamic = 'force-dynamic'

export default function NewBroadcastPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-6" style={{ color: '#1C1C1E', letterSpacing: '-0.8px' }}>
        Новая рассылка
      </h1>
      <NewBroadcastForm />
    </div>
  )
}
