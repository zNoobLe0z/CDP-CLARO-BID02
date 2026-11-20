import { afterEach, expect, it, vi } from 'vitest'
import { configureAccessToken } from './api'
import { productionService } from '../features/production/service'
import { workforceService } from '../features/workforce/service'

vi.mock('./config', () => ({
  config: {
    demo: false,
    projectId: 'obra/1',
    apiBaseUrl: 'https://api.example.test/api/v1',
  },
}))
afterEach(() => {
  configureAccessToken(async () => null)
  vi.unstubAllGlobals()
})
it('envia os cinco níveis da cascata aos filtros de dashboard e histórico', async () => {
  configureAccessToken(async () => 'test-token')
  const fetch = vi
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify({ items: [], total: 0 })),
    )
  vi.stubGlobal('fetch', fetch)
  const selected = {
    floor_id: 'floor-2',
    environment_id: 'room-1',
    discipline_id: 'finishes',
    activity_id: 'painting',
    scope_item_id: 'wall/1',
  }
  await productionService.dashboard({
    ...selected,
    reference_date: '2026-11-20',
  })
  await productionService.history({
    ...selected,
    page: 1,
    page_size: 10,
    start_date: '',
    end_date: '',
    search: '',
    status: '',
  })
  for (const [url] of fetch.mock.calls) {
    const params = new URL(url).searchParams
    for (const [key, value] of Object.entries(selected))
      expect(params.get(key)).toBe(value)
  }
})

it('consulta os contratos reais com filtros codificados e token da sessão', async () => {
  configureAccessToken(async () => 'test-token')
  const fetch = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ items: [], total: 0, page: 2, page_size: 10 }),
        ),
    )
  vi.stubGlobal('fetch', fetch)
  await productionService.history({
    page: 2,
    page_size: 10,
    start_date: '',
    end_date: '',
    status: 'active',
    search: 'Parede & pintura',
  })
  const url = new URL(fetch.mock.calls[0][0])
  expect(url.pathname).toBe('/api/v1/projects/obra%2F1/production-records')
  expect(url.searchParams.get('search')).toBe('Parede & pintura')
  expect(url.searchParams.has('start_date')).toBe(false)
  expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe(
    'Bearer test-token',
  )
})
it('correção e efetivo usam caminhos, métodos, versões e idempotência corretos', async () => {
  configureAccessToken(async () => 'test-token')
  const fetch = vi.fn().mockImplementation(async () => new Response('{}'))
  vi.stubGlobal('fetch', fetch)
  await productionService.correct(
    'record/1',
    {
      quantity: '2.5',
      reason: 'Revisão',
      expected_record_version: 1,
      expected_scope_version: 3,
    },
    'correction-key',
  )
  expect(fetch.mock.calls[0][0]).toContain(
    '/production-records/record%2F1/corrections',
  )
  expect(fetch.mock.calls[0][1].method).toBe('POST')
  expect(fetch.mock.calls[0][1].headers.get('Idempotency-Key')).toBe(
    'correction-key',
  )
  await workforceService.save(
    {
      company_id: 'company/1',
      execution_date: '2026-11-20',
      headcount: 0,
      observation: '',
      expected_version: null,
    },
    'workforce-key',
  )
  expect(fetch.mock.calls[1][0]).toContain('/workforce/2026-11-20/company%2F1')
  expect(fetch.mock.calls[1][1].method).toBe('PUT')
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
    headcount: 0,
    observation: '',
    expected_version: null,
  })
})
