import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { CatalogAdminPage } from './CatalogAdminPage'

const mocks = vi.hoisted(() => ({ request: vi.fn(), role: 'admin' }))
vi.mock('../../lib/config', () => ({
  config: { demo: false, projectId: 'test' },
}))
vi.mock('../../lib/api', () => ({ request: mocks.request }))
vi.mock('../auth/access', () => ({
  useProjectAccess: () => ({ data: { role: mocks.role } }),
}))
beforeEach(() => {
  mocks.role = 'admin'
  mocks.request.mockReset()
  mocks.request.mockImplementation(
    async (_path: string, init?: RequestInit) => {
      if (init?.method) throw new Error('Falha de conexão')
      return { items: [] }
    },
  )
})
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter([
    { path: '*', element: <CatalogAdminPage /> },
  ])
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}
it('não consulta cadastros administrativos para perfil editor', () => {
  mocks.role = 'editor'
  setup()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'exige perfil de administrador',
  )
  expect(mocks.request).not.toHaveBeenCalled()
})
it('preserva campos e chave de idempotência após falha de conexão', async () => {
  const user = setup()
  await screen.findByRole('textbox', { name: /^Identificador/ })
  await user.type(
    screen.getByRole('textbox', { name: /^Identificador/ }),
    'andar-novo',
  )
  await user.type(screen.getByLabelText('Nome', { exact: true }), 'Novo andar')
  await user.type(screen.getByLabelText('Justificativa'), 'Cadastro inicial')
  await user.click(screen.getByRole('button', { name: 'Salvar cadastro' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha de conexão')
  expect(screen.getByLabelText('Nome', { exact: true })).toHaveValue(
    'Novo andar',
  )
  await user.click(screen.getByRole('button', { name: 'Salvar cadastro' }))
  const writes = mocks.request.mock.calls.filter(
    ([, init]) => init?.method === 'POST',
  )
  expect(writes).toHaveLength(2)
  expect(writes[0][1].headers['Idempotency-Key']).toBe(
    writes[1][1].headers['Idempotency-Key'],
  )
})
