import { expect, it } from 'vitest'
import { createWorkforceDemo } from './service'
import { localDate } from '../production/measurement'

it('diferencia ausência de registro de zero e corrige sem somar pessoas', async () => {
  const service = createWorkforceDemo()
  const filters = {
    start_date: localDate(),
    end_date: localDate(),
    company_id: 'company-b',
  }
  expect(await service.list(filters)).toEqual([])
  const input = {
    execution_date: localDate(),
    company_id: 'company-b',
    headcount: 0,
    observation: '',
    expected_version: null,
  }
  const zero = await service.save(input, 'first')
  expect(await service.save(input, 'first')).toEqual(zero)
  const corrected = await service.save(
    { ...input, headcount: 5, expected_version: 1 },
    'second',
  )
  expect(await service.list(filters)).toHaveLength(1)
  expect(corrected.headcount).toBe(5)
  expect(await service.revisions(corrected.id)).toMatchObject([
    { headcount: 0, version: 1 },
  ])
  await expect(
    service.save({ ...input, headcount: 9, expected_version: 1 }, 'stale'),
  ).rejects.toMatchObject({ status: 409 })
})
it('rejeita negativos e fracionários sem gravar contagem', async () => {
  const service = createWorkforceDemo()
  const input = {
    execution_date: localDate(),
    company_id: 'company-b',
    headcount: -1,
    observation: '',
    expected_version: null,
  }
  await expect(service.save(input, 'negative')).rejects.toMatchObject({
    status: 422,
  })
  await expect(
    service.save({ ...input, headcount: 2.5 }, 'decimal'),
  ).rejects.toMatchObject({ status: 422 })
  expect(
    await service.list({
      start_date: localDate(),
      end_date: localDate(),
      company_id: 'company-b',
    }),
  ).toEqual([])
})
