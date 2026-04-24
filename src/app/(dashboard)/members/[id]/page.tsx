import { notFound } from 'next/navigation'
import { loadProfile } from '@/lib/profile-loader'
import ProfileCard from '@/components/ProfileCard'

export const revalidate = 60

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await loadProfile(id)
  if (!data || !data.member) notFound()
  return <ProfileCard data={data} backHref="/" backLabel="Все участники" />
}
