interface StatCard {
  label: string
  value: number | string
  sub?: string
  color?: string
}

export default function StatsCards({ stats }: { stats: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl p-5 ios-card"
          style={{ background: '#FFFFFF', border: '1px solid #E5E5EA', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
        >
          <div className="text-xs font-medium mb-1.5" style={{ color: '#6E6E73' }}>{s.label}</div>
          <div
            className="text-3xl font-bold tracking-tight"
            style={{ color: s.color ?? '#1D1D1F', letterSpacing: '-0.5px' }}
          >
            {s.value}
          </div>
          {s.sub && <div className="text-xs mt-1" style={{ color: '#AEAEB2' }}>{s.sub}</div>}
        </div>
      ))}
    </div>
  )
}
