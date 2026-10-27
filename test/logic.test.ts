/**
 * Zero-dependency checks for the pure prefix-attribution logic.
 *
 * `logic.ts` has no DSH or React imports, so it can be exercised without a
 * host. Run with: npm run test
 */

import assert from 'node:assert/strict'
import { diffSurfaces, hitRateOf, messageDeltaOf, verdictOf, formatFirstDiff } from '../src/client/logic'
import type { SurfaceEntry } from '../src/client/types'

const entry = (seq: number, hash = `h${seq}`): SurfaceEntry => ({ seq, hash })

let passed = 0
function check(name: string, body: () => void): void {
  body()
  passed += 1
  console.log(`  ok  ${name}`)
}

console.log('diffSurfaces')
check('no previous request yields "first"', () => {
  assert.deepEqual(diffSurfaces([], [entry(1)]), { kind: 'first' })
})
check('identical surfaces yield "same"', () => {
  assert.deepEqual(diffSurfaces([entry(1), entry(2)], [entry(1), entry(2)]), { kind: 'same' })
})
check('tail-only growth yields "append" with the added count', () => {
  assert.deepEqual(diffSurfaces([entry(1), entry(2)], [entry(1), entry(2), entry(3), entry(4)]), {
    kind: 'append',
    added: 2,
  })
})
check('rewritten head yields "rewrite" at the first differing index', () => {
  assert.deepEqual(
    diffSurfaces([entry(1), entry(2), entry(3)], [entry(1), entry(9, 'changed'), entry(3)]),
    { kind: 'rewrite', index: 1 },
  )
})
check('same seq but rewritten content still counts as a rewrite', () => {
  assert.deepEqual(
    diffSurfaces([entry(1), entry(2, 'old')], [entry(1), entry(2, 'new')]),
    { kind: 'rewrite', index: 1 },
  )
})
check('shorter surface with matching prefix yields "trim"', () => {
  assert.deepEqual(diffSurfaces([entry(1), entry(2), entry(3)], [entry(1), entry(2)]), {
    kind: 'trim',
    index: 2,
    removed: 1,
  })
})
check('shrink plus a rewrite reports the rewrite, not the trim', () => {
  assert.deepEqual(
    diffSurfaces([entry(1), entry(2), entry(3)], [entry(1), entry(9, 'changed')]),
    { kind: 'rewrite', index: 1 },
  )
})

console.log('messageDeltaOf')
check('delta is zero without a previous request', () => {
  assert.equal(messageDeltaOf([], [entry(1), entry(2)]), 0)
})
check('delta counts added and removed messages', () => {
  assert.equal(messageDeltaOf([entry(1)], [entry(1), entry(2), entry(3)]), 2)
  assert.equal(messageDeltaOf([entry(1), entry(2), entry(3)], [entry(1)]), -2)
})

console.log('hitRateOf')
check('three-bucket rate divides by uncached + read + write', () => {
  assert.equal(hitRateOf({ inputTokens: 100, cacheReadTokens: 300, cacheWriteTokens: 100 }), 0.6)
})
check('rate is undefined when no bucket is reported', () => {
  assert.equal(hitRateOf({ outputTokens: 10 }), undefined)
  assert.equal(hitRateOf(undefined), undefined)
})
check('rate ignores output tokens', () => {
  assert.equal(
    hitRateOf({ inputTokens: 100, cacheReadTokens: 100, cacheWriteTokens: 0, outputTokens: 999 }),
    0.5,
  )
})

console.log('verdictOf')
const ok = { hitRate: 0.9, firstDiff: { kind: 'append', added: 2 }, toolsChanged: false, systemChanged: false }
check('healthy rate is ok', () => {
  assert.equal(verdictOf(ok as never), 'ok')
})
check('missing cache data is no-data', () => {
  assert.equal(verdictOf({ ...ok, hitRate: undefined } as never), 'no-data')
})
check('low rate with a rewritten head is head-rewrite', () => {
  assert.equal(
    verdictOf({ ...ok, hitRate: 0.1, firstDiff: { kind: 'rewrite', index: 1 } } as never),
    'head-rewrite',
  )
})
check('low rate with an intact prefix is evicted', () => {
  assert.equal(verdictOf({ ...ok, hitRate: 0.1 } as never), 'evicted')
})
check('low rate with tool churn is tools-churn', () => {
  assert.equal(verdictOf({ ...ok, hitRate: 0.1, toolsChanged: true } as never), 'tools-churn')
})
check('low rate with system churn is system-churn', () => {
  assert.equal(verdictOf({ ...ok, hitRate: 0.1, systemChanged: true } as never), 'system-churn')
})
check('first request with a low rate is unexplained', () => {
  assert.equal(
    verdictOf({ ...ok, hitRate: 0.1, firstDiff: { kind: 'first' } } as never),
    'unexplained',
  )
})

console.log('formatFirstDiff')
check('labels match the vocabulary', () => {
  assert.equal(formatFirstDiff({ kind: 'first' }), '—')
  assert.equal(formatFirstDiff({ kind: 'same' }), '同')
  assert.equal(formatFirstDiff({ kind: 'append', added: 5 }), '尾+5')
  assert.equal(formatFirstDiff({ kind: 'rewrite', index: 3 }), '#3')
  assert.equal(formatFirstDiff({ kind: 'trim', index: 2, removed: 1 }), '#2−1')
})

console.log(`\n${passed} checks passed`)
