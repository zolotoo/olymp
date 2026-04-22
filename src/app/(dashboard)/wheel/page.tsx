import FortuneWheel from '@/components/FortuneWheel'

export const metadata = { title: 'Колесо фортуны · AI Олимп' }

export default function WheelPage() {
  return (
    <div className="py-2 sm:py-6">
      <FortuneWheel />
    </div>
  )
}
