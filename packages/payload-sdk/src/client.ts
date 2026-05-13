/**
 * Thin typed REST client for Payload. All requests carry the API key as a
 * Bearer token and the tenant slug as a `where[tenant.slug][equals]=...`
 * filter so a build for tenant X only ever sees X's data.
 */

export interface PayloadClientOptions {
  url: string                  // Payload server URL, e.g. https://cms.example.com
  apiKey?: string              // Bearer token (omit for public read collections)
  tenantSlug: string
  /** Throw if any request takes longer than this many ms. Default 30s. */
  timeoutMs?: number
}

export interface PayloadFindResult<T> {
  docs: T[]
  totalDocs: number
  page: number
  totalPages: number
  hasNextPage: boolean
  limit: number
}

export interface PayloadFindArgs {
  limit?: number
  page?: number
  sort?: string
  depth?: number
  where?: Record<string, unknown>
}

export class PayloadClient {
  private readonly url: string
  private readonly apiKey?: string
  private readonly tenantSlug: string
  private readonly timeoutMs: number
  private tenantId: string | null = null

  constructor(opts: PayloadClientOptions) {
    this.url = opts.url.replace(/\/+$/, '')
    this.apiKey = opts.apiKey
    this.tenantSlug = opts.tenantSlug
    this.timeoutMs = opts.timeoutMs ?? 30_000
  }

  /** Resolve and cache the tenant's numeric/UUID id; needed for nested filters. */
  async resolveTenantId(): Promise<string> {
    if (this.tenantId) return this.tenantId
    const res = await this.request<PayloadFindResult<{ id: string }>>(
      'GET',
      `/api/tenants?where[slug][equals]=${encodeURIComponent(this.tenantSlug)}&limit=1`
    )
    const id = res.docs[0]?.id
    if (!id) {
      throw new Error(`[payload-sdk] tenant '${this.tenantSlug}' not found in Payload`)
    }
    this.tenantId = id
    return id
  }

  async findTenant<T = unknown>(): Promise<T> {
    const res = await this.request<PayloadFindResult<T>>(
      'GET',
      `/api/tenants?where[slug][equals]=${encodeURIComponent(this.tenantSlug)}&limit=1&depth=2`
    )
    const tenant = res.docs[0]
    if (!tenant) {
      throw new Error(`[payload-sdk] tenant '${this.tenantSlug}' not found in Payload`)
    }
    return tenant
  }

  /**
   * Find all docs in a tenant-scoped collection, transparently paginating.
   * Yields rows in batches of `limit` (default 100).
   */
  async findAll<T>(collection: string, args: PayloadFindArgs = {}): Promise<T[]> {
    const tenantId = await this.resolveTenantId()
    const limit = args.limit ?? 100
    const depth = args.depth ?? 2
    const sort = args.sort ?? '-updatedAt'

    const baseWhere: Record<string, unknown> = {
      ...(args.where ?? {}),
      tenant: { equals: tenantId },
    }

    const all: T[] = []
    let page = 1
    let totalPages = 1

    do {
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      params.set('page', String(page))
      params.set('depth', String(depth))
      params.set('sort', sort)
      flattenWhere(baseWhere, '', params)

      const res = await this.request<PayloadFindResult<T>>(
        'GET',
        `/api/${collection}?${params.toString()}`
      )
      all.push(...res.docs)
      totalPages = res.totalPages
      page += 1
    } while (page <= totalPages)

    return all
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(`${this.url}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(this.apiKey ? { Authorization: `users API-Key ${this.apiKey}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`[payload-sdk] ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`)
      }
      return (await res.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }
}

/**
 * Flatten `{ tenant: { equals: 'x' }, slug: { contains: 'y' } }` into the
 * `where[tenant][equals]=x&where[slug][contains]=y` query syntax Payload uses.
 */
function flattenWhere(where: Record<string, unknown>, prefix: string, out: URLSearchParams): void {
  for (const [key, value] of Object.entries(where)) {
    const nextKey = prefix ? `${prefix}[${key}]` : `where[${key}]`
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenWhere(value as Record<string, unknown>, nextKey, out)
    } else if (Array.isArray(value)) {
      value.forEach((v) => out.append(nextKey, String(v)))
    } else if (value !== undefined && value !== null) {
      out.set(nextKey, String(value))
    }
  }
}
