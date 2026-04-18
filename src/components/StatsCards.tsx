interface StatCard {
  label: string
  value: number | string
  sub?: string
  color?: string
}

const glass = {
  background: 'rgba(255,255,255,0.66)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.07)',
} as const

export default function StatsCards({ stats }: { stats: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl p-5" style={glass}>
          <div className="text-xs font-medium mb-2" style={{ color: 'rgba(28,28,30,0.50)', letterSpacing: '-0.1px' }}>
            {s.label}
          </div>
          <div
            className="text-3xl font-bold"
            style={{ color: s.color ?? '#1C1C1E', letterSpacing: '-1px', lineHeight: 1 }}
          >
            {s.value}
          </div>
          {s.sub && <div className="text-xs mt-1.5" style={{ color: 'rgba(28,28,30,0.40)' }}>{s.sub}</div>}
        </div>
      ))}
    </div>
  )
}
