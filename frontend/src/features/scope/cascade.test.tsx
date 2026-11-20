import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { emptySelection } from './selection'
import { useScopeCascade } from './useScopeCascade'
import { ScopeCascade } from './ScopeCascade'

const service = vi.hoisted(() => ({
  floors: vi.fn(),
  environments: vi.fn(),
  disciplines: vi.fn(),
  activities: vi.fn(),
  scope: vi.fn(),
}))
vi.mock('../production/service', () => ({ productionService: service }))
beforeEach(() => {
  service.floors.mockResolvedValue([
    { id: 'a', name: 'Andar A' },
    { id: 'b', name: 'Andar B' },
  ])
  service.environments.mockImplementation(async (floor: string) =>
    floor === 'a' ? [{ id: 'room-a', name: 'Sala A' }] : [],
  )
  service.disciplines.mockResolvedValue([{ id: 'drywall', name: 'Drywall' }])
  service.activities.mockResolvedValue([{ id: 'framing', name: 'Estrutura' }])
  service.scope.mockResolvedValue([
    { id: 'wall-a', element_code: 'PAR-A', element_name: 'Parede A' },
  ])
})
function Form() {
  const [selection, setSelection] = useState(emptySelection)
  const cascade = useScopeCascade(selection)
  return (
    <ScopeCascade
      selection={selection}
      cascade={cascade}
      onChange={setSelection}
      prefix="test"
    />
  )
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <Form />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}
it('libera cada nível somente após o anterior e limpa todos os descendentes', async () => {
  const user = setup()
  await screen.findByRole('option', { name: 'Andar A' })
  for (const label of [
    'Ambiente',
    'Disciplina',
    'Atividade',
    'Elemento físico',
  ])
    expect(screen.getByRole('combobox', { name: label })).toBeDisabled()
  await user.selectOptions(screen.getByLabelText('Andar'), 'a')
  await screen.findByRole('option', { name: 'Sala A' })
  await user.selectOptions(screen.getByLabelText('Ambiente'), 'room-a')
  await screen.findByRole('option', { name: 'Drywall' })
  await user.selectOptions(screen.getByLabelText('Disciplina'), 'drywall')
  await screen.findByRole('option', { name: 'Estrutura' })
  await user.selectOptions(screen.getByLabelText('Atividade'), 'framing')
  await screen.findByRole('option', { name: 'PAR-A · Parede A' })
  await user.selectOptions(screen.getByLabelText('Elemento físico'), 'wall-a')
  expect(
    screen.getByRole('navigation', { name: 'Caminho selecionado' }),
  ).toHaveTextContent('Parede A')
  await user.selectOptions(screen.getByLabelText('Andar'), 'b')
  await screen.findByText('Nenhum ambiente cadastrado neste andar.')
  expect(screen.getByLabelText('Ambiente')).toHaveValue('')
  expect(screen.getByLabelText('Disciplina')).toBeDisabled()
  expect(screen.getByLabelText('Elemento físico')).toBeDisabled()
  expect(
    screen.queryByRole('option', { name: 'Sala A' }),
  ).not.toBeInTheDocument()
})
it('cancela a consulta antiga ao trocar de andar e ignora resposta tardia', async () => {
  let resolveOld: (value: { id: string; name: string }[]) => void = () => {}
  let oldSignal: AbortSignal | undefined
  service.environments.mockImplementation(
    (floor: string, signal: AbortSignal) => {
      if (floor !== 'a')
        return Promise.resolve([{ id: 'room-b', name: 'Sala B' }])
      oldSignal = signal
      return new Promise((resolve) => {
        resolveOld = resolve
      })
    },
  )
  const user = setup()
  await screen.findByRole('option', { name: 'Andar A' })
  await user.selectOptions(screen.getByLabelText('Andar'), 'a')
  await waitFor(() => expect(oldSignal).toBeDefined())
  await user.selectOptions(screen.getByLabelText('Andar'), 'b')
  await screen.findByRole('option', { name: 'Sala B' })
  expect(oldSignal?.aborted).toBe(true)
  await act(async () => resolveOld([{ id: 'old', name: 'Resposta antiga' }]))
  expect(
    screen.queryByRole('option', { name: 'Resposta antiga' }),
  ).not.toBeInTheDocument()
})
