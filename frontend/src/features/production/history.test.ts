import { expect, it } from 'vitest'
import { createDemoService } from './demo-service'
import { localDate, validExecutionDate } from './measurement'
import type { HistoryFilters } from './history-types'

const filters: HistoryFilters = {
  page: 1,
  page_size: 10,
  start_date: '',
  end_date: '',
  search: '',
  status: '',
}
it('preserva o original, ajusta o saldo e repete correção sem duplicar', async () => {
  const service = createDemoService()
  const record = (await service.history({ ...filters, search: 'PAR-01' }))
    .items[0]
  const correction = {
    quantity: '2.5',
    reason: 'Conferência em campo',
    expected_record_version: record.version,
    expected_scope_version: record.scope_version,
  }
  const replacement = await service.correct(
    record.id,
    correction,
    'correction-1',
  )
  expect(replacement.replaces_id).toBe(record.id)
  expect(
    (await service.scope('meeting-1', 'painting'))[0].executed_quantity,
  ).toBe('2.5')
  expect(await service.correct(record.id, correction, 'correction-1')).toEqual(
    replacement,
  )
  const history = await service.history({ ...filters, search: 'PAR-01' })
  expect(history.total).toBe(2)
  expect(history.items.find((item) => item.id === record.id)).toMatchObject({
    status: 'corrected',
    quantity: '4',
  })
  await expect(
    service.correct(record.id, correction, 'new-key'),
  ).rejects.toMatchObject({ status: 409 })
})
it('rejeita uma correção baseada em saldo antigo sem modificar o registro', async () => {
  const service = createDemoService()
  const record = (await service.history({ ...filters, search: 'PAR-01' }))
    .items[0]
  await service.save(
    {
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
    },
    'save',
  )
  await expect(
    service.correct(
      record.id,
      {
        quantity: '3',
        reason: 'Medição revista',
        expected_record_version: record.version,
        expected_scope_version: record.scope_version,
      },
      'correction',
    ),
  ).rejects.toMatchObject({ code: 'SCOPE_VERSION_CONFLICT' })
  expect(
    (
      await service.history({
        ...filters,
        search: 'PAR-01',
        status: 'corrected',
      })
    ).total,
  ).toBe(0)
})
it('valida limite do escopo, quantidade binária e justificativa', async () => {
  const service = createDemoService()
  const record = (await service.history({ ...filters, search: 'PAR-01' }))
    .items[0]
  const base = {
    quantity: '11',
    reason: 'Revisão em campo',
    expected_record_version: record.version,
    expected_scope_version: record.scope_version,
  }
  await expect(
    service.correct(record.id, base, 'exceeded'),
  ).rejects.toMatchObject({ status: 422 })
  await expect(
    service.correct(
      record.id,
      { ...base, quantity: '3', reason: 'x' },
      'reason',
    ),
  ).rejects.toMatchObject({ status: 422 })
  const unit = (await service.history({ ...filters, search: 'POR-02' }))
    .items[0]
  await expect(
    service.correct(unit.id, { ...base, quantity: '0.5' }, 'binary'),
  ).rejects.toMatchObject({ status: 422 })
})
it('filtra e pagina sem misturar registros e usa a data da obra', async () => {
  const service = createDemoService()
  expect(
    (await service.history({ ...filters, page_size: 1 })).items,
  ).toHaveLength(1)
  expect(
    (
      await service.history({
        ...filters,
        start_date: '1900-01-01',
        end_date: '1900-01-02',
      })
    ).total,
  ).toBe(0)
  expect(localDate(new Date('2026-11-20T01:00:00Z'))).toBe('2026-11-19')
  expect(validExecutionDate('2026-02-30')).toBe(false)
})
