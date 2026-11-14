import type { Entry, ScopeItem } from './types'

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parsePercentage(raw: string): number {
  const normalized = raw.trim().replace(',', '.')
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN
}

export function validateEntry(item: ScopeItem, raw: string): string | null {
  if (!raw.trim()) return null
  const percent = parsePercentage(raw)
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100)
    return 'Informe um percentual maior que zero e até 100, com até duas casas decimais.'
  const quantity = (Number(item.planned_quantity) * percent) / 100
  if (
    quantity >
    Number(item.planned_quantity) - Number(item.executed_quantity) + 1e-9
  )
    return 'O avanço informado ultrapassa o saldo disponível.'
  return null
}

export function buildEntries(
  items: ScopeItem[],
  draft: Record<string, string>,
): Entry[] {
  return items
    .filter((item) => Boolean(draft[item.id]?.trim()))
    .map((item) => {
      if (item.measurement_type === 'unit')
        return {
          scope_item_id: item.id,
          expected_version: item.version,
          measurement_type: 'unit',
          completed: true,
        }
      const error = validateEntry(item, draft[item.id])
      if (error) throw new Error(error)
      return {
        scope_item_id: item.id,
        expected_version: item.version,
        measurement_type: 'percentage',
        daily_percentage: String(parsePercentage(draft[item.id])),
      }
    })
}
