import { expect, it } from 'vitest'
import { periodStart, stagesCsv } from './analytics'
import { createDemoService } from '../production/demo-service'
import { localDate } from '../production/measurement'

const filters = {
  reference_date: localDate(),
  floor_id: '',
  environment_id: '',
  discipline_id: '',
}
it('calcula limites inclusivos de período sem depender de UTC local', () => {
  expect(periodStart('2024-03-01', '30d')).toBe('2024-02-01')
  expect(periodStart('2026-05-15', 'quarter')).toBe('2026-04-01')
  expect(periodStart('2026-05-15', 'month')).toBe('2026-05-01')
  expect(periodStart('2026-05-15', 'all')).toBe('')
})
it('fecha a curva com o avanço oficial e mantém planejamento indisponível', async () => {
  const service = createDemoService()
  const timeline = await service.timeline({
    ...filters,
    start_date: '2020-01-01',
  })
  const summary = await service.dashboard(filters)
  expect(timeline.points.at(-1)?.executed_percentage).toBe(
    summary.overall_percentage,
  )
  expect(timeline.points.length).toBeLessThanOrEqual(62)
  expect(
    timeline.points.every((point) => point.planned_percentage === null),
  ).toBe(true)
  expect(timeline.record_count).toBe(2)
})
it('exporta apenas valores físicos e neutraliza fórmulas de planilhas', async () => {
  const stages = await createDemoService().stages(filters)
  const csv = stagesCsv(
    [
      {
        ...stages.items[0],
        activity_name: '=HYPERLINK("bad")',
        environment_name: 'Sala; reunião',
      },
    ],
    filters.reference_date,
  )
  expect(csv.startsWith('\ufeff')).toBe(true)
  expect(csv).toContain('"\'=HYPERLINK(""bad"")"')
  expect(csv).toContain('"Sala; reunião"')
  expect(csv).not.toContain('R$')
})
it('permite abrir pelo UUID exatamente o apontamento do feed', async () => {
  const service = createDemoService()
  const request = {
    page: 1,
    page_size: 5,
    start_date: '',
    end_date: '',
    status: '' as const,
    search: '',
  }
  const row = (await service.history(request)).items[0]
  expect(
    (await service.history({ ...request, search: row.id })).items.map(
      (item) => item.id,
    ),
  ).toEqual([row.id])
})
