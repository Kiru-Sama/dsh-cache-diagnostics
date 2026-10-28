/**
 * Client data source: the Host's `/cache-diagnostics/api` rows.
 *
 * One poller feeds every consumer (rail icon and page), so opening both never
 * doubles the work. Rows are computed on the Host from session logs; this half
 * only renders them, which is why it cannot disturb the conversation.
 */

import { useEffect, useSyncExternalStore } from 'react'

const ENDPOINT = '/cache-diagnostics/v2'
/** Idle refresh: the page stays live without a busy loop. */
const POLL_MS = 4000
/** While the Host is folding logs, back off so scans do not queue up. */
const PENDING_MS = 8000
/** A hidden tab does not need live numbers. */
const HIDDEN_MS = 30000

/** Mirror of the Host's `CacheRow`. */
export interface Row {
  readonly sessionId: string
  readonly title?: string
  readonly time: number
  readonly turn: number
  readonly step: number
  readonly purpose: 'assistant' | 'compaction'
  readonly input: number
  readonly cacheRead: number
  readonly cacheWrite: number
  readonly output: number
  readonly hitRate?: number
  readonly changeKind?: 'initial' | 'system' | 'tools' | 'system-and-tools'
  readonly systemChanged: boolean
  readonly toolsChanged: boolean
  readonly firstDiff:
    | { readonly kind: 'first' }
    | { readonly kind: 'same' }
    | { readonly kind: 'append'; readonly added: number }
    | { readonly kind: 'rewrite'; readonly index: number }
    | { readonly kind: 'trim'; readonly index: number; readonly removed: number }
  readonly messageDelta: number
  readonly verdict: string
  readonly explanation?: string
  readonly provider?: string
  readonly model?: string
  readonly retry?: number
  readonly error?: string
}

export interface RowsState {
  readonly rows: readonly Row[]
  readonly error?: string
  readonly pending?: boolean
  readonly phase?: string
  readonly updatedAt?: number
}

const EMPTY: RowsState = { rows: [] }

let state: RowsState = EMPTY
const listeners = new Set<() => void>()
let started = false

function publish(next: RowsState): void {
  state = next
  for (const listener of listeners) listener()
}

async function tick(signal: AbortSignal): Promise<void> {
  try {
    const response = await fetch(ENDPOINT, { signal, headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = (await response.json()) as {
      ok?: boolean
      rows?: Row[]
      error?: string
      pending?: boolean
      phase?: string
    }
    if (payload.ok !== true || !Array.isArray(payload.rows)) {
      throw new Error(payload.error ?? 'bad payload')
    }
    publish({
      rows: payload.rows,
      pending: payload.pending === true,
      phase: payload.phase,
      error: payload.error,
      updatedAt: Date.now(),
    })
  } catch (error) {
    if (signal.aborted) return
    publish({ rows: state.rows, error: String((error as { message?: unknown })?.message ?? error), updatedAt: Date.now() })
  }
}

/**
 * Poll with backoff instead of a fixed interval.
 *
 * The Host folds session logs on a background pass; while that pass runs the
 * answer says `pending`, and asking again immediately would just queue another
 * scan. Refreshing fast when idle and slowly while a scan is in flight keeps the
 * page live without turning it into a CPU pump.
 */
function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  const controller = new AbortController()

  const loop = async (): Promise<void> => {
    if (document.hidden) {
      window.setTimeout(() => void loop(), HIDDEN_MS)
      return
    }
    await tick(controller.signal)
    const delay = state.pending === true ? PENDING_MS : POLL_MS
    window.setTimeout(() => void loop(), delay)
  }

  void loop()
}

/** Manual refresh from the page; harmless while another poll is in flight. */
export function refreshRows(): void {
  void tick(new AbortController().signal)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Rows for every consumer; polls while the page is visible. */
export function useRows(): RowsState {
  useEffect(start, [])
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}
