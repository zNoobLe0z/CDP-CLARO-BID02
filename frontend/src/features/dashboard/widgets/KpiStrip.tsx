import { Ruler, TrendingUp, ListChecks, ClipboardList } from 'lucide-react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { DashboardData, DashboardTimeline } from '../types'
import { number } from '../../../lib/format'
import { Skeleton } from './Widget'

export function KpiStrip({
  summary,
  timeline,
}: {
  summary: UseQueryResult<DashboardData, Error>
  timeline: UseQueryResult<DashboardTimeline, Error>
}) {
  if (summary.isPending)
    return (
      <div className="panel mb-5">
        <Skeleton kind="kpis" />
      </div>
    )
  const data = summary.data
  if (!data)
    return (
      <div role="alert" className="panel widget-error mb-5">
        <p>Indicadores físicos indisponíveis nesta consulta.</p>
        <button
          type="button"
          className="button-secondary mt-3"
          onClick={() => void summary.refetch()}
        >
          Recarregar indicadores
        </button>
      </div>
    )
  const delta = timeline.data?.delta_percentage_points
  const values = [
    {
      label: 'Avanço físico',
      value:
        data.overall_percentage === null
          ? '—'
          : `${number(data.overall_percentage)}%`,
      detail: 'Acumulado até a referência',
      icon: Ruler,
      progress: data.overall_percentage,
    },
    {
      label: 'Evolução no período',
      value:
        delta == null
          ? '—'
          : `${Number(delta) > 0 ? '+' : ''}${number(delta)} pp`,
      detail: timeline.isError
        ? 'Evolução indisponível'
        : timeline.isPending
          ? 'Calculando período…'
          : 'Diferença sobre o saldo inicial',
      icon: TrendingUp,
    },
    {
      label: 'Itens concluídos',
      value: `${data.completed_items} / ${data.total_items}`,
      detail: `${data.in_progress_items} em execução · ${data.not_started_items} a iniciar`,
      icon: ListChecks,
      progress: data.total_items
        ? String((data.completed_items / data.total_items) * 100)
        : null,
    },
    {
      label: 'Apontamentos',
      value: timeline.data ? String(timeline.data.record_count) : '—',
      detail: 'Registros válidos no período',
      icon: ClipboardList,
    },
  ]
  return (
    <div className="panel dashboard-kpis mb-5">
      {values.map(({ label, value, detail, icon: Icon, progress }) => (
        <section key={label} className="engineering-kpi">
          <div className="flex items-center justify-between gap-2">
            <h2 className="eyebrow">{label}</h2>
            <Icon size={15} className="text-secondary" aria-hidden="true" />
          </div>
          <p className="engineering-kpi-value">{value}</p>
          <p className="engineering-kpi-detail">{detail}</p>
          {progress != null && (
            <progress aria-label={label} max={100} value={Number(progress)} />
          )}
        </section>
      ))}
    </div>
  )
}
