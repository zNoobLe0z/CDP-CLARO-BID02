import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Download, SlidersHorizontal, Info } from 'lucide-react'
import { config } from '../../lib/config'
import { productionService as service } from '../production/service'
import { ScopeCascade } from '../scope/ScopeCascade'
import { useScopeCascade } from '../scope/useScopeCascade'
import { emptySelection, scopeFilters } from '../scope/selection'
import { localDate, validExecutionDate } from '../production/measurement'
import { dateLabel } from '../../lib/format'
import { periodStart, stagesCsv, type Period } from './analytics'
import { Widget, WidgetState, EmptyWidget } from './widgets/Widget'
import { KpiStrip } from './widgets/KpiStrip'
import { PhysicalProgressChart } from './widgets/PhysicalProgressChart'
import { DisciplineChart } from './widgets/DisciplineChart'
import { WorkStagesTable } from './widgets/WorkStagesTable'
import { ActivityFeed } from './widgets/ActivityFeed'

export function DashboardPage() {
  const [date, setDate] = useState(localDate)
  const [period, setPeriod] = useState<Period>('30d')
  const [selection, setSelection] = useState(emptySelection)
  const [exportError, setExportError] = useState('')
  const [controlsOpen, setControlsOpen] = useState(
    () => window.matchMedia?.('(min-width: 768px)').matches ?? true,
  )
  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 768px)')
    if (!media) return
    const change = () => setControlsOpen(media.matches)
    change()
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  const cascade = useScopeCascade(selection)
  const valid = validExecutionDate(date)
  const start = valid ? periodStart(date, period) : ''
  const filters = { reference_date: date, ...scopeFilters(selection) }
  const enabled = valid && !cascade.stale
  const summary = useQuery({
    queryKey: ['dashboard', 'summary', filters],
    queryFn: ({ signal }) => service.dashboard(filters, signal),
    enabled,
  })
  const timeline = useQuery({
    queryKey: ['dashboard', 'timeline', filters, start],
    queryFn: ({ signal }) =>
      service.timeline(
        { ...filters, ...(start ? { start_date: start } : {}) },
        signal,
      ),
    enabled,
  })
  const stages = useQuery({
    queryKey: ['dashboard', 'stages', filters],
    queryFn: ({ signal }) => service.stages(filters, signal),
    enabled,
  })
  const feedFilters = {
    ...scopeFilters(selection),
    page: 1,
    page_size: 5,
    start_date: start,
    end_date: date,
    search: '',
    status: '' as const,
  }
  const feed = useQuery({
    queryKey: ['dashboard', 'feed', feedFilters],
    queryFn: ({ signal }) => service.history(feedFilters, signal),
    enabled,
  })
  const updated = Math.max(
    summary.dataUpdatedAt,
    timeline.dataUpdatedAt,
    stages.dataUpdatedAt,
    feed.dataUpdatedAt,
  )
  function reset() {
    setSelection(emptySelection)
    setPeriod('30d')
    setDate(localDate())
  }
  function exportReport() {
    if (!stages.data?.items.length) return
    setExportError('')
    try {
      const url = URL.createObjectURL(
        new Blob([stagesCsv(stages.data.items, date)], {
          type: 'text/csv;charset=utf-8',
        }),
      )
      const link = document.createElement('a')
      link.href = url
      link.download = `frentes-${config.projectId}-${date}.csv`
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setExportError('Não foi possível exportar o arquivo. Tente novamente.')
    }
  }
  return (
    <>
      <header className="engineering-heading">
        <div>
          <p className="eyebrow">Central de engenharia</p>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">
            Referência {valid ? dateLabel(date) : 'não definida'}
            {updated
              ? ` · atualizado às ${new Date(updated).toLocaleTimeString('pt-BR')}`
              : ' · consultando indicadores'}
          </p>
        </div>
        <button
          type="button"
          className="button-secondary"
          disabled={
            !stages.data?.items.length || stages.isFetching || stages.isError
          }
          onClick={exportReport}
        >
          <Download size={15} aria-hidden="true" />
          Exportar frentes (CSV)
        </button>
      </header>
      <section
        className="panel dashboard-context"
        aria-label="Contexto e filtros operacionais"
      >
        <details
          className="context-disclosure"
          open={controlsOpen}
          onToggle={(event) => setControlsOpen(event.currentTarget.open)}
        >
          <summary>
            <span>Obra e período</span>
            <span>
              {period === 'all'
                ? 'Acumulado'
                : period === '30d'
                  ? 'Últimos 30 dias'
                  : period === 'month'
                    ? 'Mês de referência'
                    : 'Trimestre'}
            </span>
          </summary>
          <div className="dashboard-context-controls">
            <label>
              Obra
              <select
                defaultValue={config.projectId}
                aria-description="Uma obra configurada neste ambiente"
              >
                <option value={config.projectId}>CDP BI02 · CLARO</option>
              </select>
            </label>
            <label>
              Período
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value as Period)}
              >
                <option value="30d">Últimos 30 dias</option>
                <option value="month">Mês de referência</option>
                <option value="quarter">Trimestre de referência</option>
                <option value="all">Acumulado da obra</option>
              </select>
            </label>
            <label>
              Referência
              <input
                type="date"
                max={localDate()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <p className="context-caption">
              {start && valid
                ? `${dateLabel(start)} → ${dateLabel(date)}`
                : 'Todo o histórico disponível'}
              <span>KPIs e frentes acumulados na referência</span>
            </p>
          </div>
        </details>
        <details className="operational-filters">
          <summary>
            <SlidersHorizontal size={14} aria-hidden="true" />
            Filtrar frente de serviço
            {selection.floor && (
              <span className="status-badge text-brand-ink">Filtro ativo</span>
            )}
          </summary>
          <div className="pt-4">
            <ScopeCascade
              prefix="dashboard"
              selection={selection}
              cascade={cascade}
              onChange={setSelection}
            />
          </div>
        </details>
      </section>
      {exportError && (
        <p role="alert" className="mb-4 text-danger">
          {exportError}
        </p>
      )}
      {!valid ? (
        <p role="alert" className="panel p-5 text-danger">
          Informe uma data válida até hoje.
        </p>
      ) : cascade.stale ? (
        <p role="alert" className="panel p-5 text-warning">
          O contexto selecionado não está disponível.{' '}
          <button className="underline" type="button" onClick={reset}>
            Limpar filtros
          </button>
        </p>
      ) : (
        <>
          <KpiStrip summary={summary} timeline={timeline} />
          <div className="dashboard-analytics-grid">
            <Widget
              title="Evolução do avanço físico"
              subtitle="Acumulado ponderado · fechamento do dia"
              className="timeline-widget"
            >
              <WidgetState query={timeline}>
                <>
                  {timeline.data &&
                    (timeline.data.record_count ? (
                      <PhysicalProgressChart data={timeline.data} />
                    ) : (
                      <EmptyWidget
                        message="Nenhuma medição registrada para o período selecionado."
                        onReset={reset}
                      />
                    ))}
                </>
              </WidgetState>
            </Widget>
            <Widget
              title="Avanço por disciplina"
              subtitle="Percentual acumulado na referência"
              className="discipline-widget"
            >
              <WidgetState query={summary} kind="rows">
                {summary.data?.disciplines.length ? (
                  <DisciplineChart groups={summary.data.disciplines} />
                ) : (
                  <EmptyWidget
                    message="Nenhuma disciplina encontrada neste contexto."
                    onReset={reset}
                  />
                )}
              </WidgetState>
              <p className="widget-footnote">
                Peso de produção representa esforço e relevância. Não representa
                custo.
              </p>
            </Widget>
          </div>
          <div className="dashboard-operations-grid">
            <Widget
              title="Frentes de serviço"
              subtitle="Ambiente × atividade · posição acumulada"
              action={
                <Link to="/cadastros" className="widget-link">
                  Ver escopo →
                </Link>
              }
            >
              <WidgetState query={stages} kind="rows">
                {stages.data?.items.length ? (
                  <WorkStagesTable items={stages.data.items} />
                ) : (
                  <EmptyWidget
                    message="Nenhuma frente de serviço encontrada."
                    onReset={reset}
                  />
                )}
              </WidgetState>
            </Widget>
            <Widget
              title="Últimas movimentações"
              subtitle="Apontamentos pela data de execução"
              action={
                <Link to="/historico" className="widget-link">
                  Ver todas →
                </Link>
              }
            >
              <WidgetState query={feed} kind="rows">
                {feed.data?.items.length ? (
                  <ActivityFeed items={feed.data.items} />
                ) : (
                  <EmptyWidget
                    message="Nenhum apontamento no período."
                    onReset={reset}
                  />
                )}
              </WidgetState>
            </Widget>
          </div>
        </>
      )}
      <aside className="dashboard-availability">
        <Info size={15} aria-hidden="true" />
        <p>
          <strong>Planejamento e financeiro sem base vinculada.</strong>{' '}
          Comparação previsto × realizado, SPI/CPI, orçamento e caixa não estão
          disponíveis nesta obra. Os indicadores exibidos representam execução
          física após correções.
        </p>
      </aside>
    </>
  )
}
