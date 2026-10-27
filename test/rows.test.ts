/**
 * Fold tests for the Host half.
 *
 * A synthetic event log is enough here: the interesting logic is entirely a
 * function of the event stream (surface operations, header changes, usage), so
 * no Host services are involved.
 */

import { rowsFromEvents } from '../src/rows'

let checks = 0

function check(label: string, actual: unknown, expected: unknown): void {
  const actualText = JSON.stringify(actual)
  const expectedText = JSON.stringify(expected)
  if (actualText !== expectedText) {
    throw new Error(`${label}: expected ${expectedText}, got ${actualText}`)
  }
  checks += 1
  console.log(`  ok  ${label}`)
}

let seq = 0
const event = (type: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  type,
  seq: ++seq,
  time: 1000 * seq,
  data,
  ...extra,
})
const usage = (input: number, read: number, write: number, output: number) => ({
  inputTokens: input,
  cacheReadTokens: read,
  cacheWriteTokens: write,
  outputTokens: output,
})
const header = (tools: readonly string[], model = 'deepseek-flash') => ({
  header: { config: { provider: 'deepseek-account', model }, tools: tools.map(name => ({ name })) },
  reason: 'initial',
})

// Request 1: first request in the session, all input uncached.
seq = 0
const first = [
  event('session/title', { title: '测试会话' }),
  event('user/message', { message: { role: 'user' } }, { surfaceOp: 'append' }),
  event('request/header', header(['read', 'bash'])),
  event('step/start', { turn: 1, step: 1 }),
  event('assistant/message', {
    turn: 1,
    step: 1,
    message: { source: { provider: 'deepseek-account', model: 'deepseek-flash' } },
    usage: usage(1000, 0, 0, 100),
  }),
]
const firstRows = rowsFromEvents('s1', undefined, first)
check('one row for one settled request', firstRows.length, 1)
check('title comes from session/title', firstRows[0].title, '测试会话')
check('first request has no predecessor', firstRows[0].firstDiff, { kind: 'first' })
check('no message delta without a predecessor', firstRows[0].messageDelta, 0)
check('hit rate from the three buckets', firstRows[0].hitRate, 0)
check('model reported by the message source', firstRows[0].model, 'deepseek-flash')

// Request 2: tail append and a shrunken tool catalog between requests.
const second = [
  event('request/header', header(['read'])),
  event('step/start', { turn: 1, step: 2 }),
  event('assistant/message', { turn: 1, step: 2, message: {}, usage: usage(10, 5000, 0, 80) }, { surfaceOp: 'append' }),
]
const secondRows = rowsFromEvents('s1', undefined, [...first, ...second])
check('two rows after the second request', secondRows.length, 2)
check('tail append keeps the prefix intact', secondRows[1].firstDiff, { kind: 'append', added: 1 })
check('message delta counts the append', secondRows[1].messageDelta, 1)
check('tool catalog change detected', secondRows[1].toolsChanged, true)
check('system prompt unchanged', secondRows[1].systemChanged, false)
check('healthy hit rate', Math.round((secondRows[1].hitRate ?? 0) * 1000) / 1000, 0.998)
check('healthy verdict', secondRows[1].verdict, '前缀延续')

// Request 3: the first message is rewritten in place (a new system prompt also
// appears), so the prefix breaks at index 0 and the low hit is attributable.
const third = [
  event('user/message', { message: { role: 'user', edited: true } }, {
    surfaceOp: { op: 'replace', startSeq: 2, endSeq: 2 },
  }),
  event('system/message', { turn: 1, step: 3, message: { role: 'system' } }, { surfaceOp: 'append' }),
  event('request/header', header(['read'])),
  event('step/start', { turn: 1, step: 3 }),
  event('assistant/message', { turn: 1, step: 3, message: {}, usage: usage(900, 100, 0, 50) }),
]
const thirdRows = rowsFromEvents('s1', undefined, [...first, ...second, ...third])
check('system change detected', thirdRows[2].systemChanged, true)
check('rewrite at the head is located', thirdRows[2].firstDiff, { kind: 'rewrite', index: 0 })
check('low hit is attributed to the rewritten prefix', thirdRows[2].verdict.startsWith('前缀自'), true)

console.log(`\n${checks} checks passed`)
