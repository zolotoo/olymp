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

export async function getMemories(userId: string) {
  try {
    const res = await fetch(`${BASE}/memories/?user_id=olymp_${userId}`, {
      headers: headers(),
    })
    return res.json()
  } catch {
    return []
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
