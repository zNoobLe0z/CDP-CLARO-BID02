import { ApiError } from '../../lib/api'
import { validateEntry, localDate } from './measurement'
import type { BatchResult, ProductionService, ScopeItem } from './types'

export function createDemoService(): ProductionService {
  let items: ScopeItem[] = [
    {
      id: 'wall-east',
      element_code: 'PAR-01',
      element_name: 'Parede leste',
      measurement_type: 'percentage',
      unit: 'm2',
      planned_quantity: '10',
      executed_quantity: '4',
      version: 1,
    },
    {
      id: 'wall-west',
      element_code: 'PAR-02',
      element_name: 'Parede oeste',
      measurement_type: 'percentage',
      unit: 'm2',
      planned_quantity: '12',
      executed_quantity: '0',
      version: 1,
    },
    {
      id: 'door-1',
      element_code: 'POR-01',
      element_name: 'Porta de entrada',
      measurement_type: 'unit',
      unit: 'un',
      planned_quantity: '1',
      executed_quantity: '0',
      version: 1,
    },
    {
      id: 'door-2',
      element_code: 'POR-02',
      element_name: 'Porta de serviço',
      measurement_type: 'unit',
      unit: 'un',
      planned_quantity: '1',
      executed_quantity: '1',
      version: 1,
    },
  ]
  const results = new Map<string, { payload: string; result: BatchResult }>()
  const clone = <T>(value: T): T => structuredClone(value)
  return {
    floors: async () => [
      { id: 'floor-2', name: '2º andar' },
      { id: 'floor-3', name: '3º andar' },
    ],
    environments: async (floorId) =>
      floorId === 'floor-2'
        ? [{ id: 'meeting-1', name: 'Sala de reunião 01' }]
        : [],
    disciplines: async () => [{ id: 'finishes', name: 'Acabamentos' }],
    activities: async () => [
      { id: 'painting', name: 'Pintura' },
      { id: 'doors', name: 'Instalação de portas' },
    ],
    scope: async (_environmentId, activityId) =>
      clone(
        items.filter(
          (item) =>
            item.measurement_type ===
            (activityId === 'doors' ? 'unit' : 'percentage'),
        ),
      ),
    save: async (batch, key) => {
      const payload = JSON.stringify(batch)
      const cached = results.get(key)
      if (cached) {
        if (cached.payload !== payload)
          throw new ApiError(
            'A chave já foi usada com outro lançamento.',
            409,
            'IDEMPOTENCY_CONFLICT',
          )
        return clone(cached.result)
      }
      if (
        !batch.entries.length ||
        batch.execution_date > localDate() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(batch.execution_date)
      )
        throw new ApiError('Revise a data e os itens.', 422, 'VALIDATION_ERROR')
      const seen = new Set<string>()
      const updated = batch.entries.map((entry) => {
        const item = items.find(
          (candidate) => candidate.id === entry.scope_item_id,
        )
        if (!item || seen.has(entry.scope_item_id))
          throw new ApiError(
            'Item inválido ou repetido.',
            422,
            'VALIDATION_ERROR',
          )
        seen.add(item.id)
        if (item.version !== entry.expected_version)
          throw new ApiError(
            'O saldo foi alterado. Atualize os elementos antes de tentar novamente.',
            409,
            'SCOPE_VERSION_CONFLICT',
          )
        if (item.measurement_type !== entry.measurement_type)
          throw new ApiError(
            'Tipo de medição inválido.',
            422,
            'VALIDATION_ERROR',
          )
        if (entry.measurement_type === 'percentage') {
          const error = validateEntry(item, entry.daily_percentage)
          if (error || !entry.daily_percentage.trim())
            throw new ApiError(
              error ?? 'Informe o avanço.',
              422,
              'VALIDATION_ERROR',
            )
        } else if (Number(item.executed_quantity) >= 1)
          throw new ApiError(
            'Este item já foi concluído.',
            409,
            'ALREADY_COMPLETED',
          )
        const increment =
          entry.measurement_type === 'unit'
            ? 1
            : (Number(item.planned_quantity) * Number(entry.daily_percentage)) /
              100
        return {
          ...item,
          executed_quantity: String(
            Number((Number(item.executed_quantity) + increment).toFixed(6)),
          ),
          version: item.version + 1,
        }
      })
      items = items.map(
        (item) => updated.find((next) => next.id === item.id) ?? item,
      )
      const result = {
        batch_id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        items: updated,
      }
      results.set(key, { payload, result })
      return clone(result)
    },
  }
}
