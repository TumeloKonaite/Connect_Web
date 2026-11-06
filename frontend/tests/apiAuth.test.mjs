import test from 'node:test'
import assert from 'node:assert/strict'

test('protected device requests send the in-memory bearer token and handle expired sessions', async () => {
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
    await assert.rejects(api.getDevices(), /Could not validate credentials/)
    assert.equal(calls[0].url, '/api/devices')
    assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token')
    assert.equal(unauthorized, 1)
  } finally {
    setAccessToken(null)
    setUnauthorizedHandler(null)
    globalThis.fetch = originalFetch
  }
})
