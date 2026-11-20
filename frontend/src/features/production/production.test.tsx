import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProductionPage } from './ProductionPage'
import { createDemoService } from './demo-service'
import { localDate } from './measurement'
import type { ProductionBatch } from './types'
import { createMemoryRouter, RouterProvider } from 'react-router'

const batch: ProductionBatch = {
  execution_date: localDate(),
  observation: '',
  entries: [
    {
      scope_item_id: 'wall-east',
      expected_version: 1,
      measurement_type: 'percentage',
      daily_percentage: '25',
    },
  ],
}

describe('Regras do apontamento', () => {
  it('registra incremento, repete sem duplicar e rejeita chave com payload diferente', async () => {
    const service = createDemoService()
    const saved = await service.save(batch, 'same-key')
    expect(saved.items[0].executed_quantity).toBe('6.5')
    expect(await service.save(batch, 'same-key')).toEqual(saved)
    await expect(
      service.save({ ...batch, observation: 'outra' }, 'same-key'),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })
  it('rejeita saldo excedido e preserva todos os itens do lote', async () => {
    const service = createDemoService()
    await expect(
      service.save(
        {
          ...batch,
          entries: [
            ...batch.entries,
            {
              scope_item_id: 'wall-west',
              expected_version: 1,
              measurement_type: 'percentage',
              daily_percentage: '101',
            },
          ],
        },
        'invalid',
      ),
    ).rejects.toMatchObject({ status: 422 })
    expect(
      (await service.scope('meeting-1', 'painting'))[0].executed_quantity,
    ).toBe('4')
  })
  it('rejeita versão desatualizada e execução duplicada de unidade', async () => {
    const service = createDemoService()
    await service.save(batch, 'first')
    await expect(service.save(batch, 'second')).rejects.toMatchObject({
      code: 'SCOPE_VERSION_CONFLICT',
    })
    await expect(
      service.save(
        {
          ...batch,
          entries: [
            {
              scope_item_id: 'door-2',
              expected_version: 1,
              measurement_type: 'unit',
              completed: true,
            },
          ],
        },
        'unit',
      ),
    ).rejects.toMatchObject({ code: 'ALREADY_COMPLETED' })
  })
})

it('limpa seleções dependentes e valida o saldo no formulário', async () => {
  const user = userEvent.setup()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider
        router={createMemoryRouter([
          { path: '/', element: <ProductionPage /> },
        ])}
      />
    </QueryClientProvider>,
  )
  await screen.findByRole('option', { name: '2º andar' })
  await user.selectOptions(screen.getByLabelText('Andar'), 'floor-2')
  await screen.findByRole('option', { name: 'Sala de reunião 01' })
  await user.selectOptions(screen.getByLabelText('Ambiente'), 'meeting-1')
  await screen.findByRole('option', { name: 'Acabamentos' })
  await user.selectOptions(screen.getByLabelText('Disciplina'), 'finishes')
  await screen.findByRole('option', { name: 'Pintura' })
  await user.selectOptions(screen.getByLabelText('Atividade'), 'painting')
  const input = (
    await screen.findAllByLabelText('Avanço adicional do dia (%)')
  )[0]
  await user.type(input, '61')
  expect(
    screen.getByText('O avanço informado ultrapassa o saldo disponível.'),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Salvar apontamento' }),
  ).toBeDisabled()
  await user.clear(input)
  await user.type(input, '25,5')
  expect(
    screen.getByRole('button', { name: 'Salvar apontamento' }),
  ).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Salvar apontamento' }))
  await screen.findByText('Apontamento salvo com sucesso.')
  await user.selectOptions(screen.getByLabelText('Andar'), 'floor-3')
  await waitFor(() => expect(screen.getByLabelText('Ambiente')).toHaveValue(''))
  expect(screen.getByLabelText('Disciplina')).toBeDisabled()
  expect(screen.queryByText('Execução do dia')).not.toBeInTheDocument()
  client.clear()
})
