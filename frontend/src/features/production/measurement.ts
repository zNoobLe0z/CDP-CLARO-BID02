import type { Entry, ScopeItem } from './types'

export function localDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function validExecutionDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > localDate()) return false
  const date = new Date(`${value}T12:00:00Z`)
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
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
