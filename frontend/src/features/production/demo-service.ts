import { ApiError } from '../../lib/api'
import { validateEntry, localDate, validExecutionDate } from './measurement'
import { initialCatalog } from './catalog'
import type { BatchResult, ProductionService } from './types'
import type { HistoryService, ProductionRecord } from './history-types'
import type { DashboardService } from '../dashboard/types'
import { calculateDashboard } from '../dashboard/calculate'
import { matchesScope } from '../scope/selection'

const clone = <T>(value: T): T => structuredClone(value)
const decimal = (value: number) => String(Number(value.toFixed(6)))
const fail = (
  message: string,
  status = 422,
  code = 'VALIDATION_ERROR',
): never => {
  throw new ApiError(message, status, code)
}

export function createDemoService(): ProductionService &
  HistoryService &
  DashboardService {
  let items = initialCatalog()
  let records: ProductionRecord[] = []
  const results = new Map<string, { payload: string; result: BatchResult }>()
  const corrections = new Map<
    string,
    { payload: string; result: ProductionRecord }
  >()
  function recordFor(
    item: (typeof items)[number],
    quantity: string,
    date: string,
    observation: string,
  ): ProductionRecord {
    return {
      id: crypto.randomUUID(),
      scope_item_id: item.id,
      element_code: item.element_code,
      element_name: item.element_name,
      activity_name: item.activity_name,
      environment_name: item.environment_name,
      execution_date: date,
      created_at: new Date().toISOString(),
      quantity,
      unit: item.unit,
      measurement_type: item.measurement_type,
      author_name: 'Engenharia · demonstração',
      observation,
      status: 'active',
      version: 1,
      scope_version: item.version,
      replaces_id: null,
      correction_reason: null,
    }
  }
  records = items
    .filter((item) => Number(item.executed_quantity) > 0)
    .map((item) =>
      recordFor(
        item,
        item.executed_quantity,
        localDate(),
        'Medição inicial de demonstração',
      ),
    )
  return {
    dashboard: async (filters) =>
      clone(calculateDashboard(items, records, filters)),
    floors: async () => [
      { id: 'floor-2', name: '2º andar' },
      { id: 'floor-3', name: '3º andar' },
    ],
    environments: async (floorId) =>
      floorId === 'floor-2'
        ? [{ id: 'meeting-1', name: 'Sala de reunião 01' }]
        : [],
    disciplines: async (environmentId) =>
      environmentId === 'meeting-1'
        ? [{ id: 'finishes', name: 'Acabamentos' }]
        : [],
    activities: async (environmentId, disciplineId) =>
      environmentId === 'meeting-1' && disciplineId === 'finishes'
        ? [
            { id: 'painting', name: 'Pintura' },
            { id: 'doors', name: 'Instalação de portas' },
          ]
        : [],
    scope: async (environmentId, activityId) =>
      clone(
        items.filter(
          (item) =>
            item.environment_id === environmentId &&
            item.activity_id === activityId,
        ),
      ),
    catalog: async () => clone(items),
    history: async (filters) => {
      const term = filters.search.trim().toLocaleLowerCase('pt-BR')
      const filtered = records
        .filter((record) => {
          const item = items.find((item) => item.id === record.scope_item_id)
          return Boolean(item && matchesScope(item, filters))
        })
        .filter(
          (record) =>
            (!filters.start_date ||
              record.execution_date >= filters.start_date) &&
            (!filters.end_date || record.execution_date <= filters.end_date) &&
            (!filters.status || record.status === filters.status) &&
            `${record.element_code} ${record.element_name} ${record.activity_name} ${record.environment_name}`
              .toLocaleLowerCase('pt-BR')
              .includes(term),
        )
        .sort(
          (a, b) =>
            b.execution_date.localeCompare(a.execution_date) ||
            b.created_at.localeCompare(a.created_at) ||
            b.id.localeCompare(a.id),
        )
      const start = (filters.page - 1) * filters.page_size
      return {
        items: clone(
          filtered.slice(start, start + filters.page_size).map((record) => ({
            ...record,
            scope_version: items.find(
              (item) => item.id === record.scope_item_id,
            )!.version,
          })),
        ),
        total: filtered.length,
        page: filters.page,
        page_size: filters.page_size,
      }
    },
    save: async (batch, key) => {
      const payload = JSON.stringify(batch)
      const cached = results.get(key)
      if (cached) {
        if (cached.payload !== payload)
          fail(
            'A chave já foi usada com outro lançamento.',
            409,
            'IDEMPOTENCY_CONFLICT',
          )
        return clone(cached.result)
      }
      if (
        !batch.entries.length ||
        batch.entries.length > 200 ||
        !validExecutionDate(batch.execution_date) ||
        batch.observation.length > 1000
      )
        fail('Revise a data, a observação e os itens.')
      const seen = new Set<string>()
      let context = ''
      const updated = batch.entries.map((entry) => {
        const item = items.find(
          (candidate) => candidate.id === entry.scope_item_id,
        )
        if (!item || seen.has(entry.scope_item_id))
          return fail('Item inválido ou repetido.')
        const nextContext = `${item.environment_id}:${item.activity_id}`
        if (context && context !== nextContext)
          fail('O lote deve conter a mesma atividade e ambiente.')
        context = nextContext
        seen.add(item.id)
        if (item.version !== entry.expected_version)
          fail(
            'O saldo foi alterado. Atualize os elementos antes de tentar novamente.',
            409,
            'SCOPE_VERSION_CONFLICT',
          )
        if (item.measurement_type !== entry.measurement_type)
          fail('Tipo de medição inválido.')
        if (entry.measurement_type === 'percentage') {
          const error = validateEntry(item, entry.daily_percentage)
          if (error || !entry.daily_percentage.trim())
            fail(error ?? 'Informe o avanço.')
        } else if (Number(item.executed_quantity) >= 1)
          fail('Este item já foi concluído.', 409, 'ALREADY_COMPLETED')
        const increment =
          entry.measurement_type === 'unit'
            ? 1
            : (Number(item.planned_quantity) * Number(entry.daily_percentage)) /
              100
        return {
          ...item,
          executed_quantity: decimal(
            Number(item.executed_quantity) + increment,
          ),
          version: item.version + 1,
        }
      })
      const newRecords = updated.map((item) =>
        recordFor(
          item,
          decimal(
            Number(item.executed_quantity) -
              Number(
                items.find((old) => old.id === item.id)!.executed_quantity,
              ),
          ),
          batch.execution_date,
          batch.observation,
        ),
      )
      items = items.map(
        (item) => updated.find((next) => next.id === item.id) ?? item,
      )
      records.push(...newRecords)
      const result = {
        batch_id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        items: updated,
      }
      results.set(key, { payload, result })
      return clone(result)
    },
    correct: async (id, correction, key) => {
      const payload = JSON.stringify({ id, correction })
      const cached = corrections.get(key)
      if (cached) {
        if (cached.payload !== payload)
          fail('Chave de correção já utilizada.', 409, 'IDEMPOTENCY_CONFLICT')
        return clone(cached.result)
      }
      const original = records.find((record) => record.id === id)
      if (!original) return fail('Registro não encontrado.', 404, 'NOT_FOUND')
      const item = items.find(
        (candidate) => candidate.id === original.scope_item_id,
      )!
      if (
        original.status !== 'active' ||
        original.version !== correction.expected_record_version ||
        item.version !== correction.expected_scope_version
      )
        fail(
          'O registro ou o saldo foi alterado. Atualize o histórico.',
          409,
          'SCOPE_VERSION_CONFLICT',
        )
      const value = Number(correction.quantity)
      if (
        !/^\d+(\.\d{1,6})?$/.test(correction.quantity) ||
        !Number.isFinite(value) ||
        value < 0 ||
        (item.measurement_type === 'unit' && ![0, 1].includes(value)) ||
        correction.reason.trim().length < 5 ||
        correction.reason.trim().length > 1000 ||
        value === Number(original.quantity)
      )
        fail(
          'Revise a quantidade e informe uma justificativa com ao menos cinco caracteres.',
        )
      const accumulated =
        Number(item.executed_quantity) - Number(original.quantity) + value
      if (accumulated < 0 || accumulated > Number(item.planned_quantity) + 1e-9)
        fail('A correção ultrapassa a quantidade prevista.')
      const nextItem = {
        ...item,
        executed_quantity: decimal(accumulated),
        version: item.version + 1,
      }
      const replacement = {
        ...recordFor(
          nextItem,
          decimal(value),
          original.execution_date,
          original.observation,
        ),
        replaces_id: id,
        correction_reason: correction.reason.trim(),
      }
      records = records.map((record) =>
        record.id === id
          ? { ...record, status: 'corrected', version: record.version + 1 }
          : record,
      )
      records.push(replacement)
      items = items.map((candidate) =>
        candidate.id === item.id ? nextItem : candidate,
      )
      corrections.set(key, { payload, result: replacement })
      return clone(replacement)
    },
  }
}
