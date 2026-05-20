interface StatCard {
  label: string
  value: number | string
  sub?: string
  color?: string
}

export default function StatsCards({ stats }: { stats: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
      {stats.map((s) => (
        <div key={s.label} className="dk-card p-5">
          <div
            className="text-xs font-semibold mb-3 dk-muted"
            style={{ letterSpacing: '-0.1px' }}
          >
            {s.label}
          </div>
          <div
            className="font-extrabold text-[28px] md:text-[34px]"
            style={{
              color: 'var(--dk-text-1)',
              letterSpacing: '-1.2px',
              lineHeight: 1,
            }}
          >
            {s.value}
          </div>
          {s.sub && (
            <div className="text-xs mt-2 dk-muted-2">{s.sub}</div>
          )}
        </div>
      ))}
    </div>
  )
}
