/**
 * Pure request-level diagnostics over one Session's raw event log.
 *
 * No imports and no I/O: the Host reads the log, this module folds it into the
 * rows the page renders. DeepSeek cache is prefix-matched, so the interesting
 * number is not the hit rate but WHERE the first difference sits.
 */

/** One model request as the page shows it. */
export interface CacheRow {
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

interface LogEvent {
  readonly type?: string
  readonly seq?: number
  readonly time?: number
  readonly data?: Record<string, unknown>
  readonly surfaceOp?: unknown
}

const SURFACE_TYPES = new Set([
  'system/message',
  'developer/message',
  'user/message',
  'assistant/message',
  'tool/result',
])

/** Below this a request counts as a miss worth explaining. */
const HEALTHY_HIT_RATE = 0.5

/** FNV-1a over a stable serialization; used for tool catalog / payload identity. */
function hashOf(value: unknown): string {
  let text: string
  try {
    text = JSON.stringify(value) ?? 'null'
  } catch {
    text = String(value)
  }
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Apply one surface operation to the model-visible message list. */
function applySurface(surface: number[], event: LogEvent): void {
  const seq = typeof event.seq === 'number' ? event.seq : surface.length
  const op = event.surfaceOp
  if (op !== null && typeof op === 'object') {
    const range = op as { op?: string; startSeq?: number; endSeq?: number }
    if (range.op === 'replace' && typeof range.startSeq === 'number' && typeof range.endSeq === 'number') {
      const from = surface.indexOf(range.startSeq)
      const to = surface.indexOf(range.endSeq)
      if (from >= 0 && to >= from) surface.splice(from, to - from + 1, seq)
      else surface.push(seq)
      return
    }
  }
  surface.push(seq)
}

function diffOf(previous: readonly number[], next: readonly number[]): CacheRow['firstDiff'] {
  if (previous.length === 0) return { kind: 'first' }
  let common = 0
  while (common < previous.length && common < next.length && previous[common] === next[common]) {
    common += 1
  }
  if (common === previous.length && common === next.length) return { kind: 'same' }
  if (common === previous.length) return { kind: 'append', added: next.length - previous.length }
  if (common === next.length) return { kind: 'trim', index: common, removed: previous.length - next.length }
  return { kind: 'rewrite', index: common }
}

function firstDiffText(diff: CacheRow['firstDiff']): string {
  switch (diff.kind) {
    case 'first':
      return '—'
    case 'same':
      return '同'
    case 'append':
      return `尾+${diff.added}`
    case 'rewrite':
      return `#${diff.index}`
    case 'trim':
      return `#${diff.index}−${diff.removed}`
  }
}

function verdictOf(row: {
  hitRate: number | undefined
  firstDiff: CacheRow['firstDiff']
  toolsChanged: boolean
  systemChanged: boolean
}): { verdict: string; explanation?: string } {
  if (row.hitRate === undefined) return { verdict: '无用量' }
  if (row.hitRate >= HEALTHY_HIT_RATE) return { verdict: '前缀延续' }
  if (row.firstDiff.kind === 'rewrite' || row.firstDiff.kind === 'trim') {
    return {
      verdict: `前缀自 ${firstDiffText(row.firstDiff)} 断开`,
      explanation: '历史开头被改写或裁剪：往上查是谁删改了早期消息（压缩、按轮截断、图片省略）。',
    }
  }
  if (row.toolsChanged) return { verdict: '工具集变化', explanation: '工具目录在轮次间伸缩，每次变化都会断开前缀。' }
  if (row.systemChanged) return { verdict: '系统提示变化', explanation: '系统提示在轮次间变化，每次变化都会断开前缀。' }
  if (row.firstDiff.kind === 'append' || row.firstDiff.kind === 'same') {
    return { verdict: '服务端未命中', explanation: '前缀没变，是服务端缓存被挤掉或没命中：改 prompt 没用。' }
  }
  return { verdict: '低命中 · 无前缀证据' }
}

interface Pending {
  readonly seq: number
  readonly time: number
  readonly turn: number
  readonly step: number
  readonly purpose: 'assistant' | 'compaction'
  readonly surface: number[]
  usage?: { input?: number; read?: number; write?: number; output?: number }
  systemChanged: boolean
  toolsChanged: boolean
  changeKind?: CacheRow['changeKind']
  provider?: string
  model?: string
  retry?: number
  error?: string
}

/**
 * Fold one Session's events into request rows, oldest first.
 *
 * @param sessionId - owning Session.
 * @param title - folded Session title, when the query could read one.
 * @param events - the raw log in ascending sequence order.
 */
export function rowsFromEvents(
  sessionId: string,
  initialTitle: string | undefined,
  events: readonly unknown[],
): CacheRow[] {
  const rows: CacheRow[] = []
  /** The log's own `session/title` event is the cheapest source of the title. */
  let title = initialTitle
  const surface: number[] = []
  let lastRequestSurface: number[] = []
  let open: Pending | undefined
  let lastTools: string | undefined
  /** Sequence of the newest system message in the surface. */
  let currentSystem: number | undefined
  /** Sequence that was in force at the previous request header. */
  let lastHeaderSystem: number | undefined
  /** False until the first header, so "no system yet" is not read as a change. */
  let headerSeen = false
  let pendingChange: CacheRow['changeKind']
  let pendingSystemChanged = false
  let pendingToolsChanged = false
  let lastProvider: string | undefined
  let lastModel: string | undefined

  const finalize = (request: Pending, usage: NonNullable<Pending['usage']> | undefined): void => {
    const input = usage?.input ?? 0
    const read = usage?.read ?? 0
    const write = usage?.write ?? 0
    const total = input + read + write
    const hitRate = total > 0 ? read / total : undefined
    const firstDiff = diffOf(lastRequestSurface, request.surface)
    const messageDelta = lastRequestSurface.length === 0 ? 0 : request.surface.length - lastRequestSurface.length
    const { verdict, explanation } = verdictOf({
      hitRate,
      firstDiff,
      toolsChanged: request.toolsChanged,
      systemChanged: request.systemChanged,
    })
    rows.push({
      sessionId,
      title,
      time: request.time,
      turn: request.turn,
      step: request.step,
      purpose: request.purpose,
      input,
      cacheRead: read,
      cacheWrite: write,
      output: usage?.output ?? 0,
      hitRate,
      changeKind: request.changeKind,
      systemChanged: request.systemChanged,
      toolsChanged: request.toolsChanged,
      firstDiff,
      messageDelta,
      verdict,
      explanation,
      provider: request.provider ?? lastProvider,
      model: request.model ?? lastModel,
      retry: request.retry,
      error: request.error,
    })
    if (request.purpose === 'assistant') lastRequestSurface = request.surface.slice()
  }

  const numberAt = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined

  for (const raw of events) {
    const event = raw as LogEvent
    const type = typeof event?.type === 'string' ? event.type : ''
    const data = event.data ?? {}
    if (SURFACE_TYPES.has(type)) applySurface(surface, event)

    if (type === 'session/title') {
      const next = data['title']
      if (typeof next === 'string' && next.length > 0) title = next
    }

    if (type === 'system/message') {
      currentSystem = typeof event.seq === 'number' ? event.seq : currentSystem
    }

    if (type === 'request/header') {
      const header = (data['header'] ?? {}) as {
        config?: { provider?: string; model?: string }
        tools?: unknown
      }
      const provider = header.config?.provider
      const model = header.config?.model
      if (typeof provider === 'string') lastProvider = provider
      if (typeof model === 'string') lastModel = model
      const tools = hashOf(header.tools ?? null)
      const toolsChanged = lastTools !== undefined && tools !== lastTools
      const systemChanged = headerSeen && currentSystem !== lastHeaderSystem
      const changeKind: CacheRow['changeKind'] = lastTools === undefined
        ? 'initial'
        : toolsChanged && systemChanged
          ? 'system-and-tools'
          : toolsChanged
            ? 'tools'
            : systemChanged
              ? 'system'
              : undefined
      lastTools = tools
      lastHeaderSystem = currentSystem
      headerSeen = true
      if (open !== undefined) {
        open.provider = provider ?? open.provider
        open.model = model ?? open.model
        open.changeKind = changeKind
        open.toolsChanged = toolsChanged
        open.systemChanged = systemChanged
      } else {
        pendingChange = changeKind
        pendingToolsChanged = toolsChanged
        pendingSystemChanged = systemChanged
      }
      continue
    }

    if (type === 'step/start' || type === 'compaction/start') {
      const request: Pending = {
        seq: typeof event.seq === 'number' ? event.seq : 0,
        time: typeof event.time === 'number' ? event.time : 0,
        turn: numberAt(data['turn']) ?? 0,
        step: numberAt(data['step']) ?? 0,
        purpose: type === 'compaction/start' ? 'compaction' : 'assistant',
        surface: surface.slice(),
        systemChanged: pendingSystemChanged,
        toolsChanged: pendingToolsChanged,
        changeKind: pendingChange,
      }
      pendingChange = undefined
      pendingToolsChanged = false
      pendingSystemChanged = false
      open = request
      continue
    }

    if (type === 'assistant/attempt' && open !== undefined) {
      open.retry = (open.retry ?? 0) + 1
      continue
    }

    if (type === 'assistant/message' || type === 'compaction/summary') {
      if (open === undefined) continue
      const usage = data['usage'] as
        | { inputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number; outputTokens?: number }
        | undefined
      const message = data['message'] as
        | { source?: { provider?: string; model?: string } }
        | undefined
      if (message?.source !== undefined) {
        open.provider = message.source.provider ?? open.provider
        open.model = message.source.model ?? open.model
      }
      const error = data['error'] as { message?: string } | undefined
      if (error?.message !== undefined) open.error = error.message
      finalize(open, usage === undefined
        ? undefined
        : {
            input: usage.inputTokens,
            read: usage.cacheReadTokens,
            write: usage.cacheWriteTokens,
            output: usage.outputTokens,
          })
      open = undefined
    }
  }

  return rows
}
