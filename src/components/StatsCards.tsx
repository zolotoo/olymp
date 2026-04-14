interface StatCard {
  label: string
  value: number | string
  sub?: string
  color?: string
}

export default function StatsCards({ stats }: { stats: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {stats.map((s) => (
        <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-sm text-gray-400 mb-1">{s.label}</div>
          <div className={`text-3xl font-bold ${s.color ?? 'text-white'}`}>{s.value}</div>
          {s.sub && <div className="text-xs text-gray-500 mt-1">{s.sub}</div>}
        </div>
      ))}
    </div>
  )
}
