import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { createDemoService } from '../production/demo-service'
import { DashboardPage } from './DashboardPage'

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  timeline: vi.fn(),
  stages: vi.fn(),
  history: vi.fn(),
}))
vi.mock('../production/service', () => ({ productionService: mocks }))
vi.mock('../scope/useScopeCascade', () => ({
  useScopeCascade: () => ({ stale: false }),
}))
vi.mock('../scope/ScopeCascade', () => ({
  ScopeCascade: () => <p>Seleção em cascata</p>,
}))
beforeEach(() => {
  const service = createDemoService()
  mocks.dashboard.mockImplementation(service.dashboard)
  mocks.timeline.mockImplementation(service.timeline)
  mocks.stages.mockImplementation(service.stages)
  mocks.history.mockImplementation(service.history)
})
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createMemoryRouter([{ path: '*', element: <DashboardPage /> }])
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}
it('mantém frentes e movimentações quando a curva falha e permite tentar novamente', async () => {
  mocks.timeline.mockRejectedValueOnce(new Error('Falha temporária da curva'))
  const user = setup()
  const timeline = screen.getByRole('region', {
    name: 'Evolução do avanço físico',
  })
  expect(await within(timeline).findByRole('alert')).toHaveTextContent(
    'Falha temporária',
  )
  expect(await screen.findByRole('link', { name: 'Pintura' })).toBeVisible()
  await user.click(
    within(timeline).getByRole('button', { name: 'Recarregar indicador' }),
  )
  expect(
    await within(timeline).findByRole('slider', { name: 'Explorar evolução' }),
  ).toBeVisible()
})
it('exibe skeleton geométrico enquanto a curva está pendente', async () => {
  mocks.timeline.mockImplementation(() => new Promise(() => {}))
  setup()
  expect(await screen.findByRole('link', { name: 'Pintura' })).toBeVisible()
  const timeline = screen.getByRole('region', {
    name: 'Evolução do avanço físico',
  })
  expect(
    within(timeline).getByRole('status', { name: 'Carregando indicadores' }),
  ).toBeVisible()
})
it('explica período sem medições e oferece limpar os filtros', async () => {
  const service = createDemoService()
  mocks.timeline.mockImplementation(async (filters) => ({
    ...(await service.timeline(filters)),
    record_count: 0,
  }))
  setup()
  const timeline = screen.getByRole('region', {
    name: 'Evolução do avanço físico',
  })
  expect(
    await within(timeline).findByText(
      'Nenhuma medição registrada para o período selecionado.',
    ),
  ).toBeVisible()
  expect(
    within(timeline).getByRole('button', { name: 'Limpar filtros' }),
  ).toBeEnabled()
  expect(
    screen.getByText(/Planejamento e financeiro sem base vinculada/),
  ).toBeVisible()
})
