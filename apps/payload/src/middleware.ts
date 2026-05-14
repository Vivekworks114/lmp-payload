import { NextResponse } from 'next/server'

import type { NextRequest } from 'next/server'

/**
 * Recover Payload cookie-based auth when the browser (or something between it
 * and us) strips `Origin` and `Sec-Fetch-Site` from outbound fetches.
 *
 * Payload's `extractJWT` only honors a `payload-token` cookie if either:
 *   1. `Origin` is present AND matches `payload.config.csrf`, OR
 *   2. `Origin` is missing AND `Sec-Fetch-Site` is `same-origin|same-site|none`.
 *
 * Some Chrome extensions (and certain enterprise MITM proxies) rewrite outgoing
 * fetches in a way that drops BOTH headers, even on plain same-origin GETs. The
 * cookie then becomes unusable and every admin call returns 401, even though
 * the same JWT works fine via `Authorization: JWT ...`.
 *
 * This middleware synthesises an `Origin` header from `Referer` — but ONLY when
 * `Referer`'s origin is already in our allow-list. That preserves CSRF safety:
 *
 *   - Browsers set `Referer` themselves; JS on a malicious cross-site page
 *     cannot forge it to point at our admin.
 *   - We never widen the allow-list — we only re-derive what the browser would
 *     have sent if it weren't being interfered with.
 *   - If `Origin` IS present, we leave it untouched, so legitimate cross-origin
 *     enforcement still works.
 */

const ALLOWED_ORIGINS: ReadonlySet<string> = (() => {
  const set = new Set<string>()
  const server = process.env.PAYLOAD_PUBLIC_SERVER_URL?.replace(/\/+$/, '')
  if (server) set.add(server)
  for (const raw of process.env.PAYLOAD_ALLOWED_ORIGINS?.split(',') ?? []) {
    const trimmed = raw.trim().replace(/\/+$/, '')
    if (trimmed) set.add(trimmed)
  }
  if (process.env.NODE_ENV !== 'production') {
    set.add('http://localhost:3000')
  }
  return set
})()

export function middleware(req: NextRequest): NextResponse {
  if (req.headers.get('origin')) return NextResponse.next()

  const referer = req.headers.get('referer')
  if (!referer) return NextResponse.next()

  let refOrigin: string
  try {
    const url = new URL(referer)
    refOrigin = `${url.protocol}//${url.host}`
  } catch {
    return NextResponse.next()
  }

  if (!ALLOWED_ORIGINS.has(refOrigin)) return NextResponse.next()

  const forwardedHeaders = new Headers(req.headers)
  forwardedHeaders.set('origin', refOrigin)

  return NextResponse.next({ request: { headers: forwardedHeaders } })
}

export const config = {
  matcher: '/api/:path*',
}
