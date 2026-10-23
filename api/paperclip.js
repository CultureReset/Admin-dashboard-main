// Forwards /api/paperclip/* to the Paperclip server in PAPERCLIP_SERVER_URL.
// /api/paperclip/companies becomes {server}/api/companies.

export const config = { runtime: 'edge' }

// Only these request headers are forwarded. Cookies and Authorization (the
// dashboard admin token) never reach the droplet.
const FORWARD_HEADERS = ['accept', 'accept-language', 'content-type', 'user-agent']
const DEFAULT_VERIFY = 'https://gcr-api-clean.vercel.app/api/admin/gcr/claims?limit=1'

// Same admin check as api/jarvis/chat.js: the dashboard Bearer token must be
// accepted by gcr-api-clean's admin-only endpoint.
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
  if (!(await isAdmin(request.headers.get('authorization')))) {
    return Response.json({ error: 'Admin sign-in required' }, { status: 401 })
  }
  // Target comes only from env (no hardcoded HTTP fallback) so it can be HTTPS.
  const server = (process.env.PAPERCLIP_SERVER_URL || '').replace(/\/+$/, '')
  if (!server) {
    return Response.json({ error: 'PAPERCLIP_SERVER_URL is not set for this deployment' }, { status: 503 })
  }

  // vercel.json rewrites /api/paperclip/<deep/path> to /api/paperclip?__pc=<deep/path>
  // (a [...path].js catch-all only matches one segment outside Next.js).
  const incoming = new URL(request.url)
  const fromQuery = incoming.searchParams.get('__pc')
  incoming.searchParams.delete('__pc')
  const rest = fromQuery != null
    ? `/${fromQuery.replace(/^\/+/, '')}`
    : incoming.pathname.replace(/^\/api\/paperclip/, '') || '/'
  const search = incoming.searchParams.toString()
  const target = `${server}/api${rest}${search ? `?${search}` : ''}`

  const headers = new Headers()
  for (const name of FORWARD_HEADERS) {
    const v = request.headers.get(name)
    if (v) headers.set(name, v)
  }
  headers.set('x-forwarded-host', incoming.host)
  headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''))

  const hasBody = !['GET', 'HEAD'].includes(request.method)
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? 'half' : undefined,
    redirect: 'manual',
  })

  const out = new Headers(upstream.headers)
  out.delete('content-encoding')
  out.delete('content-length')
  out.delete('set-cookie')
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out })
}
