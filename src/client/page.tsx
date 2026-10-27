/**
 * The diagnostics page, shown in the main column when the rail entry is picked.
 *
 * Rows come from the Host (`/cache-diagnostics/v2`), which folds each Session's
 * raw log: hit rate, whether system/tools changed, the first differing message
 * position, the message delta and a verdict. The page polls, so new requests
 * appear within seconds without touching the conversation.
 */

import { createElement, useEffect, useMemo, useState, type ReactElement } from 'react'
import { useRows, type Row } from './api'

const STYLE_ID = 'dsh-cache-diagnostics-page'

const CSS = `
.cdx-page {
  height: 100%; min-height: 0; overflow: auto;
  padding: 28px 32px 40px; color: var(--dsw-alias-label-primary);
  font-size: 13px; line-height: 1.6;
}
.cdx-inner { max-width: 1360px; margin: 0 auto; }
.cdx-table-wrap { overflow-x: auto; }
.cdx-title { margin: 0; font-size: 18px; line-height: 26px; font-weight: 600; }
.cdx-sub { margin: 4px 0 0; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.cdx-card {
  margin-top: 18px; padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
}
.cdx-card-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 12px; margin-bottom: 4px;
  font-size: 11px; color: var(--dsw-alias-label-tertiary);
}
.cdx-rate { font-size: 28px; line-height: 32px; font-weight: 600; font-variant-numeric: tabular-nums; }
.cdx-rate.is-low { color: var(--dsw-alias-state-warn-label); }
.cdx-verdict { margin-left: 10px; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.cdx-meta {
  margin-top: 4px; font-size: 12px; color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
}
.cdx-explain {
  margin-top: 8px; padding: 8px 10px; border-radius: 8px;
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-state-warn-label); font-size: 12px;
}
.cdx-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin: 22px 0 4px;
}
.cdx-count {
  margin: 0 0 10px; font-size: 12px; line-height: 1.6;
  color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums;
}
.cdx-units {
  display: inline-flex; align-items: center; gap: 1px; padding: 1px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px;
}
.cdx-unit {
  border: none; background: transparent; cursor: pointer;
  padding: 2px 9px; border-radius: 999px;
  font: inherit; font-size: 11px; line-height: 15px;
  color: var(--dsw-alias-label-tertiary);
  transition: background .12s ease, color .12s ease;
}
.cdx-unit:hover { color: var(--dsw-alias-label-primary); }
.cdx-unit.is-active {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary); font-weight: 500;
}
.cdx-table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
.cdx-table th {
  position: sticky; top: 0; z-index: 1;
  padding: 6px 8px; text-align: left; white-space: nowrap;
  font-weight: 500; font-size: 11px; color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-bg-layer-1);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.cdx-table td { padding: 6px 8px; white-space: nowrap; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.cdx-table tbody tr:hover { background: var(--dsw-alias-interactive-bg-hover); }
.cdx-num { text-align: right; }
.cdx-table th.cdx-num { text-align: right; }
.cdx-session { max-width: 190px; overflow: hidden; text-overflow: ellipsis; }
.cdx-low { color: var(--dsw-alias-state-warn-label); font-weight: 600; }
.cdx-mark { color: var(--dsw-alias-label-tertiary); }
.cdx-mark.is-changed { color: var(--dsw-alias-state-warn-label); font-weight: 600; }
.cdx-verdict-cell { color: var(--dsw-alias-label-secondary); }
.cdx-empty {
  margin-top: 36px; padding: 28px; text-align: center;
  border: 1px dashed var(--dsw-alias-border-l2); border-radius: 12px;
  color: var(--dsw-alias-label-tertiary); font-size: 13px;
}
.cdx-legend { margin-top: 18px; font-size: 11px; line-height: 1.7; color: var(--dsw-alias-label-tertiary); }
.cdx-hint { margin-top: 8px; font-size: 11px; color: var(--dsw-alias-label-tertiary); opacity: .75; }
`

function ensureStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}

function clockOf(time: number): string {
  if (time <= 0) return '—'
  const date = new Date(time)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function tokens(value: number): string {
  if (value === 0) return '0'
  if (value < 1000) return String(value)
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`
  return `${(value / 1_000_000).toFixed(1)}M`
}

/** Cache hit display unit: percent by default, per-mille on request. */
type Unit = 'percent' | 'permille'

const UNIT_KEY = 'dsh-cache-diagnostics:unit'

function readUnit(): Unit {
  try {
    return globalThis.localStorage?.getItem(UNIT_KEY) === 'permille' ? 'permille' : 'percent'
  } catch {
    return 'percent'
  }
}

function formatRate(rate: number | undefined, unit: Unit): string {
  if (rate === undefined) return '—'
  return unit === 'permille' ? `${(rate * 1000).toFixed(1)}‰` : `${(rate * 100).toFixed(1)}%`
}

function firstDiffText(diff: Row['firstDiff']): string {
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

function mark(changed: boolean): ReactElement {
  return createElement('span', { className: `cdx-mark${changed ? ' is-changed' : ''}` }, changed ? '变' : '同')
}

function sessionOf(row: Row): string {
  if (typeof row.title === 'string' && row.title.length > 0) return row.title
  return row.sessionId.length > 12 ? `${row.sessionId.slice(0, 10)}…` : row.sessionId
}

export function CacheDiagnosticsPage(): ReactElement {
  ensureStyles()
  const { rows, error, pending, phase, updatedAt } = useRows()
  const [unit, setUnit] = useState<Unit>(readUnit)
  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(UNIT_KEY, unit)
    } catch {
      /* storage disabled: the choice still holds for this page */
    }
  }, [unit])
  /** Rendering tens of thousands of rows freezes the page; the newest slice is enough. */
  const visible = useMemo(() => rows.slice(0, 300), [rows])
  const latest = rows.length === 0 ? undefined : rows[0]
  const totals = useMemo(() => {
    let input = 0
    let cacheRead = 0
    let cacheWrite = 0
    for (const row of rows) {
      input += row.input
      cacheRead += row.cacheRead
      cacheWrite += row.cacheWrite
    }
    const total = input + cacheRead + cacheWrite
    return { input, cacheRead, cacheWrite, hitRate: total > 0 ? cacheRead / total : undefined }
  }, [rows])

  return createElement(
    'div',
    { className: 'cdx-page' },
    createElement(
      'div',
      { className: 'cdx-inner' },
      createElement('h1', { className: 'cdx-title' }, '缓存诊断'),
      createElement(
        'p',
        { className: 'cdx-sub' },
        '每次模型请求一行：命中率（千分比）、系统/工具是否变化、缓存前缀在哪一条消息断开。只读 Host 侧会话日志，自动刷新。',
      ),
      latest === undefined
        ? createElement(
            'div',
            { className: 'cdx-empty' },
            error === undefined
              ? pending === true
                ? `正在读取会话日志（${phase ?? '…'}）…`
                : '还没有记录到请求。发出下一条消息后，这里会自动出现。'
              : `读取失败：${error}`,
            error === undefined ? null : createElement('div', { className: 'cdx-hint' }, '接口：/cache-diagnostics/v2'),
          )
        : createElement(LatestCard, { row: latest, unit }),
      latest === undefined
        ? null
        : createElement(
            'div',
            { className: 'cdx-toolbar' },
            createElement('strong', { style: { fontSize: 13, fontWeight: 600 } }, '全部请求'),
            createElement(
              'span',
              { className: 'cdx-units', title: '命中率显示单位' },
              createElement('button', {
                type: 'button',
                className: `cdx-unit${unit === 'percent' ? ' is-active' : ''}`,
                onClick: () => setUnit('percent'),
              }, '百分'),
              createElement('button', {
                type: 'button',
                className: `cdx-unit${unit === 'permille' ? ' is-active' : ''}`,
                onClick: () => setUnit('permille'),
              }, '千分'),
            ),
          ),
      latest === undefined
        ? null
        : createElement(
            'p',
            { className: 'cdx-count' },
            `${rows.length} 次请求${rows.length > visible.length ? `（显示最新 ${visible.length}）` : ''} · 合计命中 ${formatRate(totals.hitRate, unit)} · `
              + `未缓存 ${tokens(totals.input)} / 缓存读 ${tokens(totals.cacheRead)} / 缓存写 ${tokens(totals.cacheWrite)}`
              + (updatedAt === undefined ? '' : ` · 更新于 ${clockOf(updatedAt)}`),
          ),
      latest === undefined
        ? null
        : createElement(
            'div',
            { className: 'cdx-table-wrap' },
            createElement(
              'table',
              { className: 'cdx-table' },
              createElement(
                'thead',
                null,
                createElement(
                  'tr',
                  null,
                  createElement('th', null, '时间'),
                  createElement('th', null, '会话'),
                  createElement('th', null, '轮·步'),
                  createElement('th', { className: 'cdx-num' }, '命中'),
                  createElement('th', { className: 'cdx-num' }, '未缓存'),
                  createElement('th', { className: 'cdx-num' }, '缓存读'),
                  createElement('th', { className: 'cdx-num' }, '缓存写'),
                  createElement('th', { className: 'cdx-num' }, '输出'),
                  createElement('th', null, '系统'),
                  createElement('th', null, '首条'),
                  createElement('th', null, '工具'),
                  createElement('th', null, '首差'),
                  createElement('th', { className: 'cdx-num' }, 'Δ'),
                  createElement('th', null, '判定'),
                ),
              ),
              createElement(
                'tbody',
                null,
                ...visible.map(row => createElement(Row, { key: `${row.sessionId}:${row.time}:${row.turn}:${row.step}`, row, unit })),
              ),
            ),
          ),
      createElement(
        'p',
        { className: 'cdx-legend' },
        '命中率按 DSH 口径：缓存读 ÷（未缓存输入＋缓存读＋缓存写），以千分比显示。'
          + '「首差」＝与同会话上一条请求相比第一处不同的消息位置：尾+N 只在尾部追加（前缀没变）；#k 表示从第 k 条起断开；#k−N 表示同时变短。'
          + '「首条」指上下文第一条消息本身变了。悬停任意一行可看模型与重试。',
      ),
    ),
  )
}

function LatestCard({ row, unit }: { readonly row: Row; readonly unit: Unit }): ReactElement {
  const low = row.hitRate !== undefined && row.hitRate < 0.5
  const route = row.provider !== undefined || row.model !== undefined
    ? `${row.provider ?? '?'} / ${row.model ?? '?'}`
    : ''
  return createElement(
    'section',
    { className: 'cdx-card' },
    createElement(
      'div',
      { className: 'cdx-card-head' },
      createElement('span', null, '最近一条'),
      createElement('span', null, `${clockOf(row.time)} · ${sessionOf(row)} · 轮${row.turn} 步${row.step}`),
    ),
    createElement(
      'div',
      null,
      createElement('span', { className: `cdx-rate${low ? ' is-low' : ''}` }, formatRate(row.hitRate, unit)),
      createElement('span', { className: 'cdx-verdict' }, row.verdict),
    ),
    createElement(
      'div',
      { className: 'cdx-meta' },
      `未缓存 ${tokens(row.input)} · 缓存读 ${tokens(row.cacheRead)} · 缓存写 ${tokens(row.cacheWrite)} · 输出 ${tokens(row.output)}`
        + ` · 首差 ${firstDiffText(row.firstDiff)} · Δ ${row.messageDelta >= 0 ? `+${row.messageDelta}` : row.messageDelta}`
        + (route === '' ? '' : ` · ${route}`),
    ),
    low && row.explanation !== undefined
      ? createElement('div', { className: 'cdx-explain' }, row.explanation)
      : null,
  )
}

function Row({ row, unit }: { readonly row: Row; readonly unit: Unit }): ReactElement {
  const low = row.hitRate !== undefined && row.hitRate < 0.5
  const tooltip = [
    `${sessionOf(row)} · 轮${row.turn} 步${row.step}`,
    `未缓存 ${row.input} · 缓存读 ${row.cacheRead} · 缓存写 ${row.cacheWrite} · 输出 ${row.output}`,
    row.provider !== undefined || row.model !== undefined ? `${row.provider ?? '?'} / ${row.model ?? '?'}` : '',
    row.changeKind === undefined ? '' : `提示词变化 ${row.changeKind}`,
    row.retry === undefined ? '' : `重试 #${row.retry}`,
    row.error === undefined ? '' : `错误 ${row.error}`,
    row.explanation ?? '',
  ].filter(line => line !== '').join('\n')

  const firstMessageChanged = row.firstDiff.kind === 'rewrite' && row.firstDiff.index === 0

  return createElement(
    'tr',
    { title: tooltip },
    createElement('td', null, clockOf(row.time)),
    createElement('td', { className: 'cdx-session' }, sessionOf(row)),
    createElement('td', null, `${row.turn}·${row.step}`),
    createElement('td', { className: `cdx-num${low ? ' cdx-low' : ''}` }, formatRate(row.hitRate, unit)),
    createElement('td', { className: 'cdx-num' }, tokens(row.input)),
    createElement('td', { className: 'cdx-num' }, tokens(row.cacheRead)),
    createElement('td', { className: 'cdx-num' }, tokens(row.cacheWrite)),
    createElement('td', { className: 'cdx-num' }, tokens(row.output)),
    createElement('td', null, mark(row.systemChanged)),
    createElement('td', null, mark(firstMessageChanged)),
    createElement('td', null, mark(row.toolsChanged)),
    createElement('td', null, firstDiffText(row.firstDiff)),
    createElement('td', { className: 'cdx-num' }, row.messageDelta > 0 ? `+${row.messageDelta}` : String(row.messageDelta)),
    createElement('td', { className: `cdx-verdict-cell${low ? ' cdx-low' : ''}` }, row.verdict),
  )
}
