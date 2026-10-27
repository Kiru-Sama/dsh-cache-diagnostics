/**
 * Host half of dsh-cache-diagnostics.
 *
 * Serves one JSON route computed from the Session logs: per model request, the
 * cache buckets, whether the system prompt or tool catalog changed, where the
 * model-visible surface first diverged, and a verdict. It registers no
 * conversation Definition and writes nothing into a Session, so it cannot
 * disturb the Chat.
 *
 * A plugin installed through the profile cannot resolve `@deepseek-ai/*` bare
 * modules at mount, so this half imports nothing but its own pure module:
 * services are read through `ctx.get`.
 */

import { rowsFromEvents, type CacheRow } from './rows'

export const name = 'dsh-cache-diagnostics'

const PATH = '/cache-diagnostics/v2'
/** Newest sessions considered on one pass; the route must stay cheap. */
const MAX_SESSIONS = 12

interface QueryService {
  listSessions(signal?: AbortSignal): Promise<readonly { header: { id: string }; live?: boolean }[]>
  listEvents(sessionId: string): Promise<readonly { seq?: number }[]>
  readSession(sessionId: string): Promise<{ events: readonly unknown[] }>
}

interface WebServer {
  register(route: { path: string; handler: (req: unknown, res: unknown) => void }): () => void
}

interface CtxLike {
  get(name: string): unknown
  inject(names: readonly string[], callback: (ctx: CtxLike) => unknown): unknown
  effect(setup: () => unknown): unknown
}

/** Cached rows per Session, invalidated by the log's last sequence. */
const cache = new Map<string, { lastSeq: number; title: string | undefined; rows: CacheRow[] }>()

let lastPayload: { ok: true; rows: CacheRow[]; sessions: number; errors?: string[]; timings?: Record<string, number> } | undefined
/** One computation at a time; the page polls and must never stack reads. */
let computing = false
/** Stage of the running (or last) computation, reported to the page. */
let phase = 'idle'
/** Last computation failure, reported to the page. */
let lastError: string | undefined

/** Bound one session read so a stuck log cannot hang the whole route. */
function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_resolve, reject) => {
      const timer: unknown = setTimeout(() => reject(new Error(`${label} timeout`)), ms)
      const unrefable = timer as { unref?: () => void }
      if (typeof unrefable.unref === 'function') unrefable.unref()
    }),
  ])
}

function json(res: unknown, status: number, body: unknown): void {
  const response = res as { statusCode?: number; setHeader?: (k: string, v: string) => void; end?: (b: string) => void }
  if (typeof response.statusCode === 'number') response.statusCode = status
  response.setHeader?.('content-type', 'application/json; charset=utf-8')
  response.setHeader?.('cache-control', 'no-store')
  response.end?.(JSON.stringify(body))
}

/** The route sits outside the harness auth fence, so refuse cross-site calls. */
function crossSite(req: { headers?: Record<string, unknown> }): boolean {
  const site = req.headers?.['sec-fetch-site']
  if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') return true
  const origin = req.headers?.['origin']
  if (typeof origin !== 'string' || origin === '') return false
  const host = req.headers?.['host']
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

async function compute(
  query: QueryService,
  limit: number,
): Promise<{ rows: CacheRow[]; sessions: number; errors: string[]; timings: Record<string, number> }> {
  const timings: Record<string, number> = {}
  const errors: string[] = []
  let started = Date.now()
  phase = 'listSessions'
  const records = await withTimeout(query.listSessions(), 4000, 'listSessions')
  timings.listSessions = Date.now() - started
  const chosen = records.slice(0, Math.max(1, limit)).map(record => record.header.id)

  const rows: CacheRow[] = []
  started = Date.now()
  for (const id of chosen) {
    phase = `session ${id.slice(0, 8)}`
    try {
      const events = await withTimeout(query.listEvents(id), 3000, 'listEvents')
      const lastSeq = events.reduce((max, event) => Math.max(max, event.seq ?? 0), 0)
      const cached = cache.get(id)
      if (cached !== undefined && cached.lastSeq === lastSeq) {
        rows.push(...cached.rows)
        continue
      }
      const log = await withTimeout(query.readSession(id), 5000, 'readSession')
      const computed = rowsFromEvents(id, undefined, log.events)
      const title = computed.find(row => row.title !== undefined)?.title
      cache.set(id, { lastSeq, title, rows: computed })
      rows.push(...computed)
    } catch (error) {
      errors.push(`${id}: ${String((error as { message?: unknown })?.message ?? error)}`)
    }
  }
  timings.sessions = Date.now() - started

  rows.sort((left, right) => right.time - left.time)
  return { rows, sessions: chosen.length, errors, timings }
}

export function apply(ctx: CtxLike): void {
  ctx.inject(['webServer'], (webCtx) => {
    const server = webCtx.get('webServer') as WebServer | undefined
    if (server === undefined || typeof server.register !== 'function') {
      console.warn('[dsh-cache-diagnostics] webServer unavailable; diagnostics route not registered.')
      return
    }
    // Registrations are tied to this plugin's lifetime: a reload must not leave
    // a stale handler on the same path (the first one wins and it would keep
    // answering with the old code).
    ctx.effect(() => server.register({
      path: '/cache-diagnostics/ping',
      handler: (_req, res) => {
        json(res, 200, { ok: true, ping: true })
      },
    }))
    ctx.effect(() => server.register({
      path: PATH,
      handler: (rawReq, res) => {
        void (async () => {
          const req = rawReq as { method?: string; headers?: Record<string, unknown>; url?: string }
          if (crossSite(req)) {
            json(res, 403, { ok: false, error: 'cross-site' })
            return
          }
          if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
            json(res, 405, { ok: false, error: 'get-only' })
            return
          }
          const url = new URL(req.url ?? PATH, 'http://localhost')
          const query = ctx.get('sessionQuery') as QueryService | undefined
          if (url.searchParams.get('probe') !== null) {
            json(res, 200, {
              ok: true,
              probe: true,
              sessionQuery: query !== undefined,
              webServer: true,
            })
            return
          }
          if (query === undefined || typeof query.listSessions !== 'function') {
            json(res, 503, { ok: false, error: 'sessionQuery unavailable' })
            return
          }
          const limitParam = Number(url.searchParams.get('limit'))
          const limit = Number.isFinite(limitParam) && limitParam > 0
            ? Math.min(limitParam, MAX_SESSIONS)
            : MAX_SESSIONS

          // Never make the caller wait: respond with the last rows and let the
          // background pass finish. The page polls, so a slow log read shows up
          // as `pending` with the exact stage instead of a hanging request.
          if (!computing) {
            computing = true
            phase = 'starting'
            void (async () => {
              try {
                const computed = await compute(query, limit)
                lastPayload = {
                  ok: true,
                  rows: computed.rows,
                  sessions: computed.sessions,
                  errors: computed.errors,
                  timings: computed.timings,
                }
                lastError = undefined
                phase = 'done'
              } catch (error) {
                lastError = String((error as { message?: unknown })?.message ?? error)
                phase = 'error'
              } finally {
                computing = false
              }
            })()
          }

          json(res, 200, {
            ok: true,
            rows: lastPayload?.rows ?? [],
            sessions: lastPayload?.sessions ?? 0,
            timings: lastPayload?.timings,
            pending: computing,
            phase,
            error: lastError,
          })
        })()
      },
    }))
  })
}
