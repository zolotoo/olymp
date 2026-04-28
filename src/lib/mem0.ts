const BASE = 'https://api.mem0.ai/v1'

function headers() {
  return {
    Authorization: `Token ${process.env.MEM0_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

export async function addMemory(userId: string, content: string) {
  try {
    const res = await fetch(`${BASE}/memories/`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        messages: [{ role: 'user', content }],
        user_id: `olymp_${userId}`,
      }),
    })
    return res.json()
  } catch {
    // Non-blocking — never fail the main flow
    return null
  }
}

export type MemoryItem = { id: string; memory: string; created_at?: string }

// mem0 v1 returns either a bare array or { results: [...] } depending on
// account/version — normalise so callers always get { results }.
export async function getMemories(userId: string): Promise<{ results: MemoryItem[] }> {
  try {
    const res = await fetch(`${BASE}/memories/?user_id=olymp_${userId}`, {
      headers: headers(),
    })
    if (!res.ok) return { results: [] }
    const json: unknown = await res.json()
    if (Array.isArray(json)) return { results: json as MemoryItem[] }
    if (json && typeof json === 'object' && Array.isArray((json as { results?: unknown }).results)) {
      return { results: (json as { results: MemoryItem[] }).results }
    }
    return { results: [] }
  } catch {
    return { results: [] }
  }
}

export async function searchMemories(userId: string, query: string) {
  try {
    const res = await fetch(`${BASE}/memories/search/`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ query, user_id: `olymp_${userId}` }),
    })
    return res.json()
  } catch {
    return []
  }
}
