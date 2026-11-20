import { expect, it } from 'vitest'
import { createDemoService } from '../production/demo-service'
import { localDate } from '../production/measurement'

const filters = {
  reference_date: localDate(),
  floor_id: '',
  environment_id: '',
  discipline_id: '',
}
it('calcula avanço no contexto da atividade e do elemento, sem incluir outros serviços', async () => {
  const service = createDemoService()
  const painting = await service.dashboard({
    ...filters,
    activity_id: 'painting',
  })
  expect(painting.total_items).toBe(2)
  expect(painting.overall_percentage).toBe('20.0000')
  const element = await service.dashboard({
    ...filters,
    activity_id: 'painting',
    scope_item_id: 'wall-east',
  })
  expect(element.overall_percentage).toBe('40.0000')
  expect(element.total_items).toBe(1)
  expect(
    (
      await service.dashboard({
        ...filters,
        activity_id: 'doors',
        scope_item_id: 'wall-east',
      })
    ).total_items,
  ).toBe(0)
})
it('calcula pesos sem somar unidades incompatíveis e atualiza após correção', async () => {
  const service = createDemoService()
  const initial = await service.dashboard(filters)
  expect(initial.overall_percentage).toBe('32.0000')
  expect(initial.not_started_items).toBe(2)
  expect(initial.in_progress_items).toBe(1)
  expect(initial.completed_items).toBe(1)
  expect(initial.daily_production.map((row) => row.unit).sort()).toEqual([
    'm2',
    'un',
  ])
  const record = (
    await service.history({
      page: 1,
      page_size: 10,
      start_date: '',
      end_date: '',
      search: 'PAR-01',
      status: 'active',
    })
  ).items[0]
  await service.correct(
    record.id,
    {
      quantity: '2',
      reason: 'Revisão da medição',
      expected_record_version: record.version,
      expected_scope_version: record.scope_version,
    },
    'correct',
  )
  const corrected = await service.dashboard(filters)
  expect(corrected.overall_percentage).toBe('26.0000')
  expect(
    corrected.daily_production.find((row) => row.unit === 'm2')?.quantity,
  ).toBe('2')
})
it('diferencia escopo vazio de execução zero e respeita data de referência', async () => {
  const service = createDemoService()
  expect(
    (await service.dashboard({ ...filters, floor_id: 'floor-3' }))
      .overall_percentage,
  ).toBeNull()
  const before = await service.dashboard({
    ...filters,
    reference_date: '1900-01-01',
  })
  expect(before.total_items).toBe(4)
  expect(before.overall_percentage).toBe('0.0000')
  expect(before.daily_production).toEqual([])
})
