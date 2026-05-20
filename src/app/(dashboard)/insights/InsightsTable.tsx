'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type InsightDTO = {
  tg_id: number
  summary: string | null
  suggested_action: string | null
  engagement_hook: string | null
  draft_message: string | null
  generated_at: string
  model: string | null
}

export type RowDTO = {
  tg_id: number
  tg_first_name: string | null
  tg_username: string | null
  funnel_stage: string
  engagement_score: number
  days_since_active: number | null
  goal: string | null
  top_kinds: { kind: string; clicks: number }[] | null
  subscription_active: boolean
  rank: string | null
  points: number | null
  mini_app_opens_30d: number
  library_clicks_30d: number
  messages_30d: number
  insight: InsightDTO | null
}

const STAGE_LABEL: Record<string, { label: string; color: string }> = {
  visitor:    { label: 'Гость',         color: '#8E8E93' },
  onboarded:  { label: 'Анкета',        color: '#5AC8FA' },
  engaged:    { label: 'Изучает',       color: '#FF9F0A' },
  member:     { label: 'Участник',      color: '#30D158' },
  churn_risk: { label: 'Риск',          color: '#FF9500' },
  churned:    { label: 'Ушёл',          color: '#FF3B30' },
}

const KIND_LABEL: Record<string, string> = {
  trends: 'тренды', practice: 'практика', guides: 'гайды',
  streams: 'эфиры', results: 'результаты', rules: 'правила', free: 'бесплатное',
}

export default function InsightsTable({ initial }: { initial: RowDTO[] }) {
  const [rows, setRows] = useState<RowDTO[]>(initial)
  const [filter, setFilter] = useState<'all' | 'with_draft' | 'no_draft'>('all')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [bulkProgress, setBulkProgress] = useState<{ total: number; done: number; ok: number; err: number } | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editedDraft, setEditedDraft] = useState<Record<number, string>>({})

  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'with_draft' && !r.insight?.draft_message) return false
      if (filter === 'no_draft' && r.insight?.draft_message) return false
      if (stageFilter !== 'all' && r.funnel_stage !== stageFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const name = `${r.tg_first_name ?? ''} ${r.tg_username ?? ''} ${r.tg_id}`.toLowerCase()
        if (!name.includes(q)) return false
      }
      return true
    })
  }, [rows, filter, stageFilter, search])

  const stats = useMemo(() => {
    let withDraft = 0
    for (const r of rows) if (r.insight?.draft_message) withDraft++
    return { total: rows.length, withDraft, withoutDraft: rows.length - withDraft }
  }, [rows])

  async function runBulk(force: boolean) {
    setBulkRunning(true)
    setBulkProgress({ total: 0, done: 0, ok: 0, err: 0 })

    try {
      const res = await fetch('/api/insights/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      if (!res.body) {
        setBulkRunning(false)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let total = 0
      let done = 0
      let ok = 0
      let err = 0
      const updatedIds: number[] = []

      while (true) {
        const { value, done: streamDone } = await reader.read()
        if (streamDone) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const evt = JSON.parse(line) as
              | { type: 'start'; total: number }
              | { type: 'row'; tg_id: number; ok: boolean }
              | { type: 'done'; ok: number; errors: number; total: number }
            if (evt.type === 'start') total = evt.total
            else if (evt.type === 'row') {
              done++
              if (evt.ok) { ok++; updatedIds.push(evt.tg_id) } else { err++ }
              setBulkProgress({ total, done, ok, err })
            } else if (evt.type === 'done') {
              setBulkProgress({ total: evt.total, done: evt.total, ok: evt.ok, err: evt.errors })
            }
          } catch { /* пропускаем мусор */ }
        }
      }

      // Подтянем свежие insights для обновлённых юзеров (один запрос — массово)
      if (updatedIds.length > 0) {
        const r = await fetch('/api/insights/refresh?' + new URLSearchParams({ ids: updatedIds.join(',') }))
        if (r.ok) {
          const data = await r.json() as { insights: InsightDTO[] }
          const map = new Map(data.insights.map((i) => [i.tg_id, i]))
          setRows((prev) => prev.map((p) => map.has(p.tg_id) ? { ...p, insight: map.get(p.tg_id)! } : p))
        }
      }
    } finally {
      setBulkRunning(false)
    }
  }

  async function regenerateOne(tgId: number) {
    const res = await fetch(`/api/insights/${tgId}`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json() as { summary: string; suggested_action: string; engagement_hook: string; draft_message: string; model: string }
      setRows((prev) => prev.map((p) => p.tg_id === tgId ? {
        ...p,
        insight: {
          tg_id: tgId,
          summary: data.summary,
          suggested_action: data.suggested_action,
          engagement_hook: data.engagement_hook,
          draft_message: data.draft_message,
          generated_at: new Date().toISOString(),
          model: data.model,
        },
      } : p))
    }
  }

  async function sendDM(tgId: number) {
    const draft = editedDraft[tgId]
    const res = await fetch(`/api/insights/${tgId}/send-dm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft ? { text: draft } : {}),
    })
    if (res.ok) {
      alert('✅ Отправлено')
    } else {
      const data = await res.json().catch(() => ({}))
      alert('Ошибка: ' + (data.message || data.error || res.statusText))
    }
  }

  async function toDraft(tgId: number) {
    const draft = editedDraft[tgId]
    const res = await fetch(`/api/insights/${tgId}/to-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft ? { text: draft } : {}),
    })
    if (res.ok) {
      const data = await res.json() as { redirect: string }
      window.location.href = data.redirect
    } else {
      const data = await res.json().catch(() => ({}))
      alert('Ошибка: ' + (data.message || data.error || res.statusText))
    }
  }

  return (
    <div>
      {/* Тулбар */}
      <div className="rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-3" style={panelStyle}>
        <button
          onClick={() => runBulk(false)}
          disabled={bulkRunning}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: '#0A84FF', color: '#fff' }}
        >
          {bulkRunning ? 'Генерим…' : '✨ Сгенерировать всё'}
        </button>
        <button
          onClick={() => runBulk(true)}
          disabled={bulkRunning}
          className="px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: 'rgba(28,28,30,0.06)', color: '#1C1C1E' }}
          title="Перегенерировать даже свежие"
        >
          ↻ Force
        </button>
        {bulkProgress && (
          <div className="text-sm" style={{ color: '#6E6E73' }}>
            {bulkProgress.done}/{bulkProgress.total} · <b style={{ color: '#30D158' }}>{bulkProgress.ok} ok</b>
            {bulkProgress.err > 0 && <> · <b style={{ color: '#FF3B30' }}>{bulkProgress.err} err</b></>}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <input
            type="search"
            placeholder="🔎 имя или tg_id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm rounded-lg px-3 py-1.5"
            style={{ border: '1px solid rgba(28,28,30,0.12)', background: '#fff', minWidth: 200 }}
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="text-sm rounded-lg px-3 py-1.5"
            style={{ border: '1px solid rgba(28,28,30,0.12)', background: '#fff' }}
          >
            <option value="all">все стадии</option>
            {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="text-sm rounded-lg px-3 py-1.5"
            style={{ border: '1px solid rgba(28,28,30,0.12)', background: '#fff' }}
          >
            <option value="all">все ({stats.total})</option>
            <option value="with_draft">с драфтом ({stats.withDraft})</option>
            <option value="no_draft">без драфта ({stats.withoutDraft})</option>
          </select>
        </div>
      </div>

      {/* Список */}
      <div className="space-y-2">
        {visibleRows.map((r) => {
          const stage = STAGE_LABEL[r.funnel_stage] ?? { label: r.funnel_stage, color: '#8E8E93' }
          const expanded = expandedId === r.tg_id
          const draftValue = editedDraft[r.tg_id] ?? r.insight?.draft_message ?? ''
          return (
            <div key={r.tg_id} className="rounded-2xl p-4" style={panelStyle}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/audience/${r.tg_id}`}
                      className="text-sm font-semibold"
                      style={{ color: '#0A84FF' }}
                    >
                      {r.tg_first_name || r.tg_username || `id:${r.tg_id}`}
                    </Link>
                    <span
                      className="text-[10px] font-bold uppercase"
                      style={{
                        padding: '2px 8px', borderRadius: 50,
                        background: `${stage.color}1A`, color: stage.color, letterSpacing: '0.6px',
                      }}
                    >
                      {stage.label}
                    </span>
                    <span className="text-xs" style={{ color: '#8E8E93' }}>
                      engagement {r.engagement_score} · {r.days_since_active ?? '—'}д без активности
                    </span>
                    {r.goal && <span className="text-xs" style={{ color: '#8E8E93' }}>· цель: {r.goal}</span>}
                    {r.top_kinds && r.top_kinds[0] && (
                      <span className="text-xs" style={{ color: '#8E8E93' }}>
                        · топ: {KIND_LABEL[r.top_kinds[0].kind] || r.top_kinds[0].kind}
                      </span>
                    )}
                  </div>

                  {r.insight?.engagement_hook && (
                    <div className="mt-2 text-sm font-medium" style={{ color: '#1D1D1F' }}>
                      🎯 {r.insight.engagement_hook}
                    </div>
                  )}
                  {r.insight?.summary && !expanded && (
                    <div className="mt-1 text-sm line-clamp-2" style={{ color: '#6E6E73' }}>
                      {r.insight.summary}
                    </div>
                  )}
                  {!r.insight && (
                    <div className="mt-1 text-sm" style={{ color: '#AEAEB2' }}>
                      инсайт ещё не сгенерирован
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {r.insight?.draft_message ? (
                    <>
                      <button
                        onClick={() => setExpandedId(expanded ? null : r.tg_id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: 'rgba(10,132,255,0.10)', color: '#0A84FF' }}
                      >
                        {expanded ? 'Свернуть' : 'Открыть DM'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => regenerateOne(r.tg_id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: '#0A84FF', color: '#fff' }}
                    >
                      ✨ Сгенерировать
                    </button>
                  )}
                </div>
              </div>

              {expanded && r.insight && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(28,28,30,0.08)' }}>
                  {r.insight.summary && (
                    <div className="text-sm mb-3" style={{ color: '#1D1D1F' }}>{r.insight.summary}</div>
                  )}
                  {r.insight.suggested_action && (
                    <div
                      className="text-sm mb-3 rounded-xl px-3 py-2"
                      style={{ background: 'rgba(48,209,88,0.10)', color: '#1D1D1F', borderLeft: '3px solid #30D158' }}
                    >
                      <b style={{ color: '#248A3D' }}>→ Действие: </b>
                      {r.insight.suggested_action}
                    </div>
                  )}
                  <div className="text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: '#8E8E93', letterSpacing: '0.5px' }}>
                    Черновик DM (можно отредактировать)
                  </div>
                  <textarea
                    value={draftValue}
                    onChange={(e) => setEditedDraft({ ...editedDraft, [r.tg_id]: e.target.value })}
                    rows={5}
                    className="w-full text-sm rounded-lg px-3 py-2"
                    style={{ border: '1px solid rgba(28,28,30,0.12)', background: '#fff', color: '#1D1D1F' }}
                  />
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => sendDM(r.tg_id)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: '#30D158', color: '#fff' }}
                    >
                      📤 Отправить DM сейчас
                    </button>
                    <button
                      onClick={() => toDraft(r.tg_id)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: 'rgba(10,132,255,0.12)', color: '#0A84FF' }}
                    >
                      📝 В черновик broadcast
                    </button>
                    <button
                      onClick={() => regenerateOne(r.tg_id)}
                      className="px-3 py-2 rounded-xl text-sm font-semibold ml-auto"
                      style={{ background: 'rgba(28,28,30,0.06)', color: '#1C1C1E' }}
                    >
                      ↻ Перегенерировать
                    </button>
                  </div>
                  <div className="text-xs mt-2" style={{ color: '#AEAEB2' }}>
                    {r.insight.model || 'llm'} · {new Date(r.insight.generated_at).toLocaleString('ru')}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {visibleRows.length === 0 && (
          <div className="text-sm" style={{ color: '#8E8E93' }}>Под фильтр никто не подходит.</div>
        )}
      </div>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
}
