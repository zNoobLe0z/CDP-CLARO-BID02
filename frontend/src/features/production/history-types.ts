import type { ScopeItem } from './types'

export interface CatalogItem extends ScopeItem {
  floor_id: string
  floor_name: string
  environment_id: string
  environment_name: string
  discipline_id: string
  discipline_name: string
  activity_id: string
  activity_name: string
  production_weight: string
}
export interface ProductionRecord {
  id: string
  scope_item_id: string
  element_code: string
  element_name: string
  activity_name: string
  environment_name: string
  execution_date: string
  created_at: string
  quantity: string
  unit: ScopeItem['unit']
  measurement_type: ScopeItem['measurement_type']
  author_name: string
  observation: string
  status: 'active' | 'corrected'
  version: number
  scope_version: number
  replaces_id: string | null
  correction_reason: string | null
}
export interface HistoryFilters {
  page: number
  page_size: number
  start_date: string
  end_date: string
  search: string
  status: '' | 'active' | 'corrected'
}
export interface HistoryPage {
  items: ProductionRecord[]
  total: number
  page: number
  page_size: number
}
export interface Correction {
  quantity: string
  reason: string
  expected_record_version: number
  expected_scope_version: number
}
export interface HistoryService {
  history(filters: HistoryFilters, signal?: AbortSignal): Promise<HistoryPage>
  correct(
    id: string,
    correction: Correction,
    key: string,
  ): Promise<ProductionRecord>
  catalog(signal?: AbortSignal): Promise<CatalogItem[]>
}
