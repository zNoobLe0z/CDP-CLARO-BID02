export interface Option {
  id: string
  name: string
}
export interface ScopeItem {
  id: string
  element_code: string
  element_name: string
  measurement_type: 'percentage' | 'unit'
  unit: 'm2' | 'm' | 'un'
  planned_quantity: string
  executed_quantity: string
  version: number
}
export type Entry = { scope_item_id: string; expected_version: number } & (
  | { measurement_type: 'percentage'; daily_percentage: string }
  | { measurement_type: 'unit'; completed: true }
)
export interface ProductionBatch {
  execution_date: string
  observation: string
  entries: Entry[]
}
export interface BatchResult {
  batch_id: string
  created_at: string
  items: ScopeItem[]
}
export interface ProductionService {
  floors(signal?: AbortSignal): Promise<Option[]>
  environments(floorId: string, signal?: AbortSignal): Promise<Option[]>
  disciplines(environmentId: string, signal?: AbortSignal): Promise<Option[]>
  activities(
    environmentId: string,
    disciplineId: string,
    signal?: AbortSignal,
  ): Promise<Option[]>
  scope(
    environmentId: string,
    activityId: string,
    signal?: AbortSignal,
  ): Promise<ScopeItem[]>
  save(batch: ProductionBatch, key: string): Promise<BatchResult>
}
