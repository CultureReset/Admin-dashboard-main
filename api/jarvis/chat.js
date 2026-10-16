// POST /api/jarvis/chat → Jarvis (OpenAI-compatible) /v1/chat/completions.
//
// The Jarvis key lives only here, in OPENJARVIS_API_KEY on the Vercel project;
// it never reaches the browser bundle. Because this endpoint spends that key,
// it is not open: the caller's admin session (the same Bearer token the rest of
// the dashboard sends to gcr-api-clean) is checked against the API first.
//
// Env:
//   JARVIS_SERVER_URL    default http://165.22.133.121.sslip.io:8000 (raw IPs are blocked by Vercel fetch)
//   OPENJARVIS_API_KEY   required
//   JARVIS_MODEL         optional default model
//   ADMIN_VERIFY_URL     default https://gcr-api-clean.vercel.app/api/admin/gcr/claims?limit=1

export const config = { runtime: 'edge' }

const DEFAULT_SERVER = 'http://165.22.133.121.sslip.io:8000'
const DEFAULT_VERIFY = 'https://gcr-api-clean.vercel.app/api/admin/gcr/claims?limit=1'
const MAX_BODY = 200_000

const json = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

async function isAdmin(authorization) {
  if (!authorization?.startsWith('Bearer ')) return false
  try {
    const r = await fetch(process.env.ADMIN_VERIFY_URL || DEFAULT_VERIFY, {
      headers: { authorization, accept: 'application/json', 'cache-control': 'no-cache' },
    })
    return r.ok
  } catch {
    return false
  }
}

export default async function handler(request) {
  if (request.method !== 'POST') return json(405, { error: 'POST only' })
  const key = process.env.OPENJARVIS_API_KEY
  if (!key) return json(503, { error: 'OPENJARVIS_API_KEY is not set for this deployment' })
  if (!(await isAdmin(request.headers.get('authorization')))) return json(401, { error: 'Admin sign-in required' })

  const raw = await request.text()
  if (raw.length > MAX_BODY) return json(413, { error: 'Conversation too long' })
  let body
  try { body = JSON.parse(raw) } catch { return json(400, { error: 'Invalid JSON' }) }
  if (!Array.isArray(body?.messages) || !body.messages.length) return json(400, { error: 'messages[] required' })

  const payload = {
    model: body.model || process.env.JARVIS_MODEL || undefined,
    messages: body.messages
      .filter((m) => m && ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string')
      .slice(-40),
    stream: !!body.stream,
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
  }

  const server = (process.env.JARVIS_SERVER_URL || DEFAULT_SERVER).replace(/\/+$/, '')
  let upstream
  try {
    upstream = await fetch(`${server}/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: payload.stream ? 'text/event-stream' : 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    return json(502, { error: 'Could not reach Jarvis' })
  }
  // Pass the body through (works for both JSON and SSE streaming).
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    },
  })
}
