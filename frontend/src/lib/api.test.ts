import { afterEach, expect, it, vi } from 'vitest'
import { configureAccessToken, request } from './api'

afterEach(() => {
  configureAccessToken(async () => null)
  vi.unstubAllGlobals()
})
it('bloqueia chamadas reais sem autenticação', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  await expect(request('/projects')).rejects.toMatchObject({
    code: 'AUTH_REQUIRED',
  })
  expect(fetch).not.toHaveBeenCalled()
})
it('envia sessão e chave de idempotência e interpreta erros da API', async () => {
  configureAccessToken(async () => 'test-access-token')
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        error: {
          code: 'SCOPE_VERSION_CONFLICT',
          message: 'Saldo atualizado.',
        },
      }),
      { status: 409 },
    ),
  )
  vi.stubGlobal('fetch', fetch)
  await expect(
    request('/production-batches', {
      method: 'POST',
      body: '{}',
      headers: { 'Idempotency-Key': 'test-key' },
    }),
  ).rejects.toMatchObject({
    status: 409,
    code: 'SCOPE_VERSION_CONFLICT',
    message: 'Saldo atualizado.',
  })
  const headers = fetch.mock.calls[0][1].headers as Headers
  expect(headers.get('Authorization')).toBe('Bearer test-access-token')
  expect(headers.get('Idempotency-Key')).toBe('test-key')
})
