import type { ScopeFilters } from '../scope/selection'
export interface DashboardFilters extends Partial<ScopeFilters> {
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
  timeline(
    filters: DashboardFilters & { start_date?: string },
    signal?: AbortSignal,
  ): Promise<DashboardTimeline>
  stages(
    filters: DashboardFilters,
    signal?: AbortSignal,
  ): Promise<DashboardStages>

  dashboard(
    filters: DashboardFilters,
    signal?: AbortSignal,
  ): Promise<DashboardData>
}

export interface TimelinePoint {
  date: string
  executed_percentage: string | null
  planned_percentage: string | null
}
export interface DashboardTimeline {
  start_date: string
  end_date: string
  baseline_percentage: string | null
  delta_percentage_points: string | null
  record_count: number
  planned_available: boolean
  points: TimelinePoint[]
}
export interface WorkStage {
  environment_id: string
  activity_id: string
  floor_id: string
  discipline_id: string
  environment_name: string
  floor_name: string
  activity_name: string
  discipline_name: string
  percentage: string
  total_items: number
  completed_items: number
  status: 'not_started' | 'in_progress' | 'completed'
  last_execution_date: string | null
  budget: null
  schedule_deviation: null
}
export interface DashboardStages {
  reference_date: string
  items: WorkStage[]
}
