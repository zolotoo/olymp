import { notFound } from 'next/navigation'
import { loadProfile } from '@/lib/profile-loader'
import ProfileCard from '@/components/ProfileCard'

export const dynamic = 'force-dynamic'

export default async function AudienceProfilePage({ params }: { params: Promise<{ tg_id: string }> }) {
  const { tg_id } = await params
  const num = Number(tg_id)
  if (!Number.isFinite(num)) notFound()
  const data = await loadProfile(num)
  if (!data) notFound()
  return <ProfileCard data={data} backHref="/audience" backLabel="Вся аудитория" />
}
