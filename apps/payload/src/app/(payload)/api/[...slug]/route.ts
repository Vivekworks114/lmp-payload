import config from '@payload-config'
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes'

// TEMPORARY DEBUG WRAPPER — log exactly what Payload sees for every /api request,
// then mirror the response status. Remove once we've diagnosed the 401.
const DEBUG =
  process.env.PAYLOAD_DEBUG_AUTH === '1' || process.env.NODE_ENV !== 'production'

function debugWrap<T extends (...args: any[]) => Promise<Response> | Response>(
  method: string,
  handler: T,
): T {
  if (!DEBUG) return handler
  return (async (req: Request, ctx: any) => {
    const url = new URL(req.url)
    const headers: Record<string, string | null> = {
      origin: req.headers.get('origin'),
      'sec-fetch-site': req.headers.get('sec-fetch-site'),
      referer: req.headers.get('referer'),
      cookie: req.headers.get('cookie') ? '<present>' : null,
    }
    const start = Date.now()
    const res = await handler(req, ctx)
    const ms = Date.now() - start

    let bodySnippet = ''
    const shouldLogBody =
      res.status >= 400 ||
      method === 'DELETE' ||
      method === 'PATCH' ||
      url.pathname.includes('/users') ||
      url.pathname.endsWith('/populate-tenant-options')

    if (shouldLogBody) {
      try {
        const clone = res.clone()
        const text = await clone.text()
        bodySnippet = text.slice(0, 500)
      } catch {
        bodySnippet = '<unreadable>'
      }
    }

    console.log(
      `[payload-debug] ${method} ${url.pathname} → ${res.status} (${ms}ms)`,
      JSON.stringify(headers),
      bodySnippet ? `body: ${bodySnippet}` : '',
    )
    return res
  }) as T
}

export const GET = debugWrap('GET', REST_GET(config))
export const POST = debugWrap('POST', REST_POST(config))
export const DELETE = debugWrap('DELETE', REST_DELETE(config))
export const PATCH = debugWrap('PATCH', REST_PATCH(config))
export const PUT = debugWrap('PUT', REST_PUT(config))
export const OPTIONS = debugWrap('OPTIONS', REST_OPTIONS(config))
