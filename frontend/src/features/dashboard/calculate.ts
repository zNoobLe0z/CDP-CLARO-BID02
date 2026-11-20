import type { CatalogItem, ProductionRecord } from '../production/history-types'
import type { DashboardData, DashboardFilters } from './types'
import { matchesScope } from '../scope/selection'

// Somente para a demonstração. Em modo API, indicadores são calculados pelo backend.
export function calculateDashboard(
  catalog: CatalogItem[],
  records: ProductionRecord[],
  filters: DashboardFilters,
): DashboardData {
  const items = catalog.filter((item) => matchesScope(item, filters))
  const active = records.filter(
    (record) =>
      record.status === 'active' &&
      record.execution_date <= filters.reference_date &&
      items.some((item) => item.id === record.scope_item_id),
  )
  const quantities = new Map<string, number>()
  active.forEach((record) =>
    quantities.set(
      record.scope_item_id,
      (quantities.get(record.scope_item_id) ?? 0) + Number(record.quantity),
    ),
  )
  const progress = (item: CatalogItem) =>
    (quantities.get(item.id) ?? 0) / Number(item.planned_quantity)
  const percentage = (subset: CatalogItem[]) => {
    const weights = subset.reduce(
      (total, item) => total + Number(item.production_weight),
      0,
    )
    return weights > 0
      ? (
          (subset.reduce(
            (total, item) =>
              total + progress(item) * Number(item.production_weight),
            0,
          ) /
            weights) *
          100
        ).toFixed(4)
      : null
  }
  const ids = [...new Set(items.map((item) => item.discipline_id))]
  const production = new Map<
    string,
    DashboardData['daily_production'][number]
  >()
  active.forEach((record) => {
    const item = items.find(
      (candidate) => candidate.id === record.scope_item_id,
    )!
    const key = `${record.execution_date}:${item.activity_id}:${record.unit}`
    const previous = production.get(key)
    production.set(key, {
      date: record.execution_date,
      activity_name: item.activity_name,
      unit: record.unit,
      quantity: String(
        Number(
          (Number(previous?.quantity ?? 0) + Number(record.quantity)).toFixed(
            6,
          ),
        ),
      ),
    })
  })
  return {
    reference_date: filters.reference_date,
    overall_percentage: percentage(items),
    total_items: items.length,
    not_started_items: items.filter((item) => progress(item) === 0).length,
    in_progress_items: items.filter(
      (item) => progress(item) > 0 && progress(item) < 1,
    ).length,
    completed_items: items.filter((item) => progress(item) >= 1).length,
    disciplines: ids.map((id) => {
      const subset = items.filter((item) => item.discipline_id === id)
      return {
        id,
        name: subset[0].discipline_name,
        percentage: percentage(subset) ?? '0',
        total_items: subset.length,
        completed_items: subset.filter((item) => progress(item) >= 1).length,
      }
    }),
    daily_production: [...production.values()]
      .filter((row) => Number(row.quantity) > 0)
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          a.activity_name.localeCompare(b.activity_name),
      ),
  }
}
