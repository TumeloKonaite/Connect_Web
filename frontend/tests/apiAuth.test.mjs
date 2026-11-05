import test from 'node:test'
import assert from 'node:assert/strict'
import { Blob } from 'node:buffer'

test('CSV import sends the in-memory bearer token and handles expired sessions', async () => {
  globalThis.import = undefined
  globalThis.__vite_injected__ = { env: { VITE_API_BASE_URL: '' } }
  globalThis.import_meta = { env: { VITE_API_BASE_URL: '' } }
  const { api, setAccessToken, setUnauthorizedHandler } = await import('../src/services/api.ts')
  const originalFetch = globalThis.fetch
  const calls = []
  let unauthorized = 0
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ detail: 'Could not validate credentials' }),
    }
  }
  setAccessToken('test-token')
  setUnauthorizedHandler(() => { unauthorized += 1 })
  try {
    const upload = new Blob(['udi'])
    upload.name = 'test.csv'
    await assert.rejects(api.importCsv(upload), /Could not validate credentials/)
    assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token')
    assert.equal(unauthorized, 1)
  } finally {
    setAccessToken(null)
    setUnauthorizedHandler(null)
    globalThis.fetch = originalFetch
  }
})
