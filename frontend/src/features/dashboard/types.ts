export interface DashboardFilters {
  reference_date: string
  floor_id: string
  environment_id: string
  discipline_id: string
}
export interface ProgressGroup {
  id: string
  name: string
  percentage: string
  total_items: number
  completed_items: number
}
export interface DashboardData {
  reference_date: string
  overall_percentage: string | null
  total_items: number
  not_started_items: number
  in_progress_items: number
  completed_items: number
  disciplines: ProgressGroup[]
  daily_production: {
    date: string
    activity_name: string
    unit: 'm2' | 'm' | 'un'
    quantity: string
  }[]
}
export interface DashboardService {
  dashboard(
    filters: DashboardFilters,
    signal?: AbortSignal,
  ): Promise<DashboardData>
}
