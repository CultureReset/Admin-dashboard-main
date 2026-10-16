// Forwards /api/paperclip/* to the Paperclip server in PAPERCLIP_SERVER_URL.
// /api/paperclip/companies becomes {server}/api/companies.

export const config = { runtime: 'edge' }

const DEFAULT_PAPERCLIP = 'http://165.22.133.121.sslip.io:3100'

const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host', 'content-length']

export default async function handler(request) {
  // Vercel's fetch refuses raw IP hosts, so the Droplet is reached by its
  // sslip.io name (165.22.133.121.sslip.io resolves to 165.22.133.121).
  // PAPERCLIP_SERVER_URL still wins; this is only the fallback.
  const server = (process.env.PAPERCLIP_SERVER_URL || DEFAULT_PAPERCLIP).replace(/\/+$/, '')
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

  const headers = new Headers(request.headers)
  for (const name of HOP_BY_HOP) headers.delete(name)
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
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out })
}
