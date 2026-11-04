import test from 'node:test'
import assert from 'node:assert/strict'
import { numericScale } from '../src/lib/numericScale.js'

test('numeric scale keeps positive measurements focused and labels clean ticks', () => {
  const scale = numericScale([42.8, 26.6])
  assert.ok(scale.min > 0)
  assert.ok(scale.max > 42.8)
  assert.ok(scale.ticks.length >= 2 && scale.ticks.length <= 8)
  assert.ok(scale.ticks.every(Number.isFinite))
})

test('numeric scale includes zero for data that crosses zero', () => {
  const scale = numericScale([-3, 0, 4])
  assert.ok(scale.min < -3)
  assert.ok(scale.max > 4)
  assert.ok(scale.ticks.includes(0))
})

test('numeric scale handles only negative values and a single observation', () => {
  const negative = numericScale([-8, -2])
  assert.ok(negative.max < 0)
  assert.ok(negative.ticks.every((tick) => tick <= 0))

  const single = numericScale([0])
  assert.ok(single.min < 0 && single.max > 0)
  assert.ok(single.ticks.includes(0))
})

test('numeric scale ignores malformed values and rejects an empty dataset', () => {
  assert.deepEqual(numericScale([Number.NaN, Number.POSITIVE_INFINITY]), null)
  const scale = numericScale([Number.NaN, 0, 10])
  assert.ok(scale.min < 0 && scale.max > 10)
})
