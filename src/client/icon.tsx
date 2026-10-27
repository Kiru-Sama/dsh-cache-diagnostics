/**
 * The rail icon for the diagnostics page.
 *
 * The sidebar owns the button (it selects the matching main panel by this
 * entry's id), so the plugin supplies only the glyph plus a status dot: green
 * when the newest request reused the cache, amber when it missed, grey before
 * there is any data. The tooltip carries the number.
 */

import { createElement, type ReactElement } from 'react'
import { useRows } from './api'

export function CacheDiagnosticsIcon({
  size = 20,
  active,
}: {
  readonly size?: number
  readonly active?: boolean
}): ReactElement {
  const { rows } = useRows()
  const latest = rows[0]
  const rate = latest?.hitRate
  const known = rate !== undefined
  const low = known && rate < 0.5
  const dot = !known
    ? 'var(--dsw-alias-border-l2)'
    : low
      ? 'var(--dsw-alias-state-warn-label)'
      : 'var(--dsw-alias-state-success-primary)'
  const color = active === true ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)'
  const title = latest === undefined
    ? '缓存诊断'
    : `缓存诊断 · 最近一次命中 ${rate === undefined ? '未知' : `${(rate * 1000).toFixed(1)}‰`}`

  return createElement(
    'span',
    {
      title,
      style: { position: 'relative', display: 'inline-flex', width: size, height: size, color },
    },
    createElement(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: false,
      },
      createElement('path', { d: 'M12 3.2 3.8 7.4 12 11.6l8.2-4.2L12 3.2Z' }),
      createElement('path', { d: 'M3.8 12 12 16.2 20.2 12' }),
      createElement('path', { d: 'M3.8 16.5 12 20.7l8.2-4.2' }),
    ),
    createElement('i', {
      style: {
        position: 'absolute',
        right: -1,
        bottom: -1,
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: dot,
        boxShadow: '0 0 0 2px var(--dsw-alias-bg-layer-1)',
      },
    }),
  )
}
