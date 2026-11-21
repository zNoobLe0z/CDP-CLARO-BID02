import type { CatalogItem, ProductionRecord } from '../production/history-types'
import type {
  DashboardFilters,
  DashboardTimeline,
  DashboardStages,
  WorkStage,
} from './types'
import { calculateDashboard } from './calculate'
import { matchesScope } from '../scope/selection'

export type Period = 'month' | '30d' | 'quarter' | 'all'
export function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function periodStart(end: string, period: Period) {
  if (period === 'all') return ''
  if (period === '30d') return addDays(end, -29)
  if (period === 'month') return `${end.slice(0, 7)}-01`
  const quarter = Math.floor((Number(end.slice(5, 7)) - 1) / 3) * 3 + 1
  return `${end.slice(0, 4)}-${String(quarter).padStart(2, '0')}-01`
}
// Demo calculations only. API mode uses Decimal results from the backend.
export function demoTimeline(
  items: CatalogItem[],
  records: ProductionRecord[],
  filters: DashboardFilters & { start_date?: string },
): DashboardTimeline {
  const subset = items.filter((item) => matchesScope(item, filters))
  const ids = new Set(subset.map((item) => item.id))
  const active = records
    .filter(
      (row) =>
        row.status === 'active' &&
        row.execution_date <= filters.reference_date &&
        ids.has(row.scope_item_id),
    )
    .sort((a, b) => a.execution_date.localeCompare(b.execution_date))
  const start =
    filters.start_date || active[0]?.execution_date || filters.reference_date
  const baselineDate = addDays(start, -1)
  const percentage = (day: string) =>
    calculateDashboard(items, records, { ...filters, reference_date: day })
      .overall_percentage
  const baseline = percentage(baselineDate)
  const span = Math.round(
    (Date.parse(filters.reference_date) - Date.parse(start)) / 86400000,
  )
  const step = Math.max(1, Math.ceil(span / 59))
  const dates = new Set([baselineDate, start, filters.reference_date])
  for (let offset = 0; offset <= span; offset += step)
    dates.add(addDays(start, offset))
  return {
    start_date: start,
    end_date: filters.reference_date,
    baseline_percentage: baseline,
    delta_percentage_points: subset.length
      ? (Number(percentage(filters.reference_date)) - Number(baseline)).toFixed(
          4,
        )
      : null,
    record_count: active.filter((row) => row.execution_date >= start).length,
    planned_available: false,
    points: subset.length
      ? [...dates].sort().map((date) => ({
          date,
          executed_percentage: percentage(date),
          planned_percentage: null,
        }))
      : [],
  }
}
export function demoStages(
  items: CatalogItem[],
  records: ProductionRecord[],
  filters: DashboardFilters,
): DashboardStages {
  const groups = new Map<string, CatalogItem[]>()
  items
    .filter((item) => matchesScope(item, filters))
    .forEach((item) => {
      const key = JSON.stringify([item.environment_id, item.activity_id])
      groups.set(key, [...(groups.get(key) ?? []), item])
    })
  const rows: WorkStage[] = [...groups.values()].map((subset) => {
    const item = subset[0]
    const ids = new Set(subset.map((row) => row.id))
    const active = records.filter(
      (row) =>
        ids.has(row.scope_item_id) &&
        row.status === 'active' &&
        row.execution_date <= filters.reference_date,
    )
    const summary = calculateDashboard(subset, active, filters)
    const percentage = summary.overall_percentage ?? '0'
    return {
      environment_id: item.environment_id,
      activity_id: item.activity_id,
      floor_id: item.floor_id,
      discipline_id: item.discipline_id,
      environment_name: item.environment_name,
      floor_name: item.floor_name,
      activity_name: item.activity_name,
      discipline_name: item.discipline_name,
      percentage,
      total_items: subset.length,
      completed_items: summary.completed_items,
      status:
        Number(percentage) >= 100
          ? 'completed'
          : Number(percentage) > 0
            ? 'in_progress'
            : 'not_started',
      last_execution_date:
        active
          .map((row) => row.execution_date)
          .sort()
          .at(-1) ?? null,
      budget: null,
      schedule_deviation: null,
    }
  })
  return { reference_date: filters.reference_date, items: rows }
}
export function stageLink(row: WorkStage) {
  return `/cadastros?${new URLSearchParams({ andar: row.floor_id, ambiente: row.environment_id, disciplina: row.discipline_id, atividade: row.activity_id })}`
}
export function stagesCsv(rows: WorkStage[], reference: string) {
  const cell = (value: string | number) =>
    `"${String(value)
      .replace(/^\s*[=+@\-\t\r\n]/, "'$&")
      .replaceAll('"', '""')}"`
  return (
    '\ufeff' +
    [
      [
        'Referência',
        'Andar',
        'Ambiente',
        'Disciplina',
        'Atividade',
        'Avanço (%)',
        'Concluídos',
        'Itens',
        'Última execução',
      ],
      ...rows.map((row) => [
        reference,
        row.floor_name,
        row.environment_name,
        row.discipline_name,
        row.activity_name,
        row.percentage.replace('.', ','),
        row.completed_items,
        row.total_items,
        row.last_execution_date ?? '',
      ]),
    ]
      .map((row) => row.map(cell).join(';'))
      .join('\r\n')
  )
}
export function relativeTime(date: string, now = Date.now()) {
  const elapsed = Math.max(0, Math.floor((now - Date.parse(date)) / 1000))
  if (elapsed < 60) return 'agora'
  if (elapsed < 3600) return `há ${Math.floor(elapsed / 60)} min`
  if (elapsed < 86400) return `há ${Math.floor(elapsed / 3600)} h`
  if (elapsed < 172800) return 'ontem'
  return `há ${Math.floor(elapsed / 86400)} dias`
}
