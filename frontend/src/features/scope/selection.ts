import type { CatalogItem } from '../production/history-types'

export const levels = [
  'floor',
  'environment',
  'discipline',
  'activity',
  'element',
] as const
export type ScopeLevel = (typeof levels)[number]
export type ScopeSelection = Record<ScopeLevel, string>
export const emptySelection: ScopeSelection = {
  floor: '',
  environment: '',
  discipline: '',
  activity: '',
  element: '',
}
export interface ScopeFilters {
  floor_id: string
  environment_id: string
  discipline_id: string
  activity_id: string
  scope_item_id: string
}

export function selectScope(
  current: ScopeSelection,
  level: ScopeLevel,
  value: string,
): ScopeSelection {
  const index = levels.indexOf(level)
  if (index > 0 && !current[levels[index - 1]]) return current
  if (current[level] === value) return current
  return Object.fromEntries(
    levels.map((key, position) => [
      key,
      position < index ? current[key] : position === index ? value : '',
    ]),
  ) as ScopeSelection
}
export function scopeFilters(selection: ScopeSelection): ScopeFilters {
  return {
    floor_id: selection.floor,
    environment_id: selection.environment,
    discipline_id: selection.discipline,
    activity_id: selection.activity,
    scope_item_id: selection.element,
  }
}
export function matchesScope(
  item: CatalogItem,
  filters: Partial<ScopeFilters>,
) {
  return (
    (!filters.floor_id || item.floor_id === filters.floor_id) &&
    (!filters.environment_id ||
      item.environment_id === filters.environment_id) &&
    (!filters.discipline_id || item.discipline_id === filters.discipline_id) &&
    (!filters.activity_id || item.activity_id === filters.activity_id) &&
    (!filters.scope_item_id || item.id === filters.scope_item_id)
  )
}
