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
          tick={{ fontSize: 11, fill: '#AEAEB2' }}
          tickFormatter={(v: string) => v.slice(5)}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: '#AEAEB2' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #E5E5EA',
            borderRadius: 12,
            fontSize: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
          labelStyle={{ color: '#6E6E73' }}
          itemStyle={{ color: '#1D1D1F' }}
          formatter={(v: number) => [v, 'сообщений']}
        />
        <Bar dataKey="message_count" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.message_count === max ? '#0A84FF' : '#E5E5EA'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
