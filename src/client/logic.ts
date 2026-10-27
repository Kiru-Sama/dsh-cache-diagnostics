/**
 * Pure prefix-attribution logic: no DSH imports, no React, no I/O.
 *
 * Keeping this file pure is what makes the diff rules testable without a host
 * and keeps the bundle free of runtime `@deepseek-ai` imports.
 */

import {
  type CacheUsage,
  type FirstDiff,
  type RequestRow,
  type SurfaceEntry,
  type Verdict,
  HEALTHY_HIT_RATE,
} from './types'

/** FNV-1a over the serialized payload: stable, allocation-light, no crypto. */
export function hashPayload(value: unknown): string {
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

/**
 * Official DSH cache rate.
 *
 * DSH reports three disjoint buckets — uncached input, cache read, cache
 * write — so the input side of the request is their sum. This matches the
 * rate DSH's own status line reports; the two-bucket
 * `read / (read + uncached)` figure some plugins use is a miss threshold, not
 * a hit rate, and is deliberately not what this computes.
 */
export function hitRateOf(usage: CacheUsage | undefined): number | undefined {
  if (!usage) return undefined
  const input = usage.inputTokens
  const read = usage.cacheReadTokens
  const write = usage.cacheWriteTokens
  if (typeof input !== 'number' && typeof read !== 'number' && typeof write !== 'number') {
    return undefined
  }
  const uncached = typeof input === 'number' ? input : 0
  const hit = typeof read === 'number' ? read : 0
  const written = typeof write === 'number' ? write : 0
  const total = uncached + hit + written
  if (total <= 0) return undefined
  return hit / total
}

/**
 * Locate the first position where two consecutive request surfaces diverge.
 *
 * DeepSeek's cache is prefix-matched, so this single index decides how much of
 * the prompt survives: an append leaves the prefix intact, a rewrite at index
 * `k` invalidates everything from `k` onward.
 */
export function diffSurfaces(
  previous: readonly SurfaceEntry[],
  next: readonly SurfaceEntry[],
): FirstDiff {
  if (previous.length === 0) return { kind: 'first' }

  let common = 0
  const limit = Math.min(previous.length, next.length)
  while (common < limit) {
    const before = previous[common]
    const after = next[common]
    if (before.seq !== after.seq || before.hash !== after.hash) break
    common += 1
  }

  if (common === previous.length && common === next.length) return { kind: 'same' }
  if (common === previous.length) return { kind: 'append', added: next.length - previous.length }
  if (common === next.length) {
    return { kind: 'trim', index: common, removed: previous.length - next.length }
  }
  return { kind: 'rewrite', index: common }
}

/** Message-count change between two consecutive requests. */
export function messageDeltaOf(
  previous: readonly SurfaceEntry[],
  next: readonly SurfaceEntry[],
): number {
  if (previous.length === 0) return 0
  return next.length - previous.length
}

/**
 * Name the cause when a request misses cache, using the prefix evidence.
 *
 * Ordering follows the diagnosticity of each signal: a rewritten head is the
 * most specific explanation, then tool churn, then system churn, and finally
 * the case where the prefix is provably intact — which can only mean the
 * server dropped the cache, and which no prompt edit will fix.
 */
export function verdictOf(row: {
  readonly hitRate: number | undefined
  readonly firstDiff: FirstDiff
  readonly toolsChanged: boolean
  readonly systemChanged: boolean
}): Verdict {
  const rate = row.hitRate
  if (rate === undefined) return 'no-data'
  if (rate >= HEALTHY_HIT_RATE) return 'ok'

  if (row.firstDiff.kind === 'rewrite' || row.firstDiff.kind === 'trim') return 'head-rewrite'
  if (row.toolsChanged) return 'tools-churn'
  if (row.systemChanged) return 'system-churn'
  if (row.firstDiff.kind === 'append' || row.firstDiff.kind === 'same') return 'evicted'
  return 'unexplained'
}

/** Short `首差` label, matching the vocabulary used by the AstrBot original. */
export function formatFirstDiff(diff: FirstDiff): string {
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

/** One-line `判定` text: what the diff means for the cache. */
export function formatVerdict(row: RequestRow): string {
  switch (row.verdict) {
    case 'ok':
      return '前缀延续'
    case 'no-data':
      return '无缓存字段'
    case 'head-rewrite':
      return `前缀自 ${formatFirstDiff(row.firstDiff)} 断开`
    case 'evicted':
      return '前缀未变 · 服务端未命中'
    case 'tools-churn':
      return '工具集变化'
    case 'system-churn':
      return '系统提示变化'
    case 'unexplained':
      return '低命中 · 无前缀证据'
  }
}

/** Why a low-hit row happened, phrased as the next thing to look at. */
export function explainVerdict(verdict: Verdict): string | undefined {
  switch (verdict) {
    case 'head-rewrite':
      return '历史开头被改写或裁剪：往上查是谁删改了早期消息（压缩、截断、图片省略）。'
    case 'evicted':
      return '前缀没变，是服务端缓存被挤掉或没命中：改 prompt 没用。'
    case 'tools-churn':
      return '工具集在轮次间伸缩（菜单 / 过滤 / 动态工具）：每次变化都会断开前缀。'
    case 'system-churn':
      return '系统提示在轮次间变化：每次变化都会断开前缀。'
    case 'unexplained':
      return '前缀证据不足以定位：可能是首次写入、或提供方侧缓存过期。'
    default:
      return undefined
  }
}

/** Signed message-count change, e.g. `+5` / `-3` / `0`. */
export function formatDelta(delta: number): string {
  if (delta === 0) return '0'
  return delta > 0 ? `+${delta}` : String(delta)
}

/** Percent with one decimal, or `—` when the request reported no cache data. */
export function formatRate(rate: number | undefined): string {
  if (rate === undefined) return '—'
  return `${(rate * 100).toFixed(1)}%`
}
