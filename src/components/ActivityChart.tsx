'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Row {
  week_start: string
  message_count: number
}

export default function ActivityChart({ data }: { data: Row[] }) {
  const max = Math.max(...data.map((d) => d.message_count))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="week_start"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickFormatter={(v: string) => v.slice(5)}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#9ca3af' }}
          itemStyle={{ color: '#fff' }}
          formatter={(v: number) => [v, 'сообщений']}
        />
        <Bar dataKey="message_count" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.message_count === max ? '#6366f1' : '#1e293b'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
