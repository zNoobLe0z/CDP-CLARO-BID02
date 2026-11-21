import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { ScopeCascade } from '../scope/ScopeCascade'
import { useScopeCascade } from '../scope/useScopeCascade'
import { emptySelection, scopeFilters } from '../scope/selection'

import { QueryFeedback } from '../../components/QueryFeedback'
import { productionService as service } from '../production/service'
import { localDate, validExecutionDate } from '../production/measurement'
import { dateLabel, number, units } from '../../lib/format'

export function DashboardPage() {
  const [date, setDate] = useState(localDate)
  const [selection, setSelection] = useState(emptySelection)
  const cascade = useScopeCascade(selection)
  const filters = { reference_date: date, ...scopeFilters(selection) }
  const validDate = validExecutionDate(filters.reference_date)
  const query = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: ({ signal }) => service.dashboard(filters, signal),
    enabled: validDate && !cascade.stale,
  })
  const data = query.data
  const error = query.error
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Avanço físico e produção consolidada · CDP BI02 / CLARO"
      />
      <section className="panel mb-5 p-4" aria-label="Filtros do dashboard">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label
            htmlFor="reference-date"
            className="grid w-full max-w-52 gap-1.5 text-xs font-medium"
          >
            Acumulado até
            <input
              id="reference-date"
              type="date"
              max={localDate()}
              value={filters.reference_date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <p className="text-xs text-secondary">
            {selection.floor
              ? 'Consulta por frente de serviço'
              : 'Consolidação da obra'}{' '}
            · quantidades por unidade
          </p>
        </div>
        <details className="mt-3 border-t border-line pt-3">
          <summary className="min-h-10 text-xs font-medium text-brand-ink">
            Detalhar por local e atividade
          </summary>
          <div className="mt-3">
            <ScopeCascade
              prefix="dashboard"
              selection={selection}
              cascade={cascade}
              onChange={setSelection}
            />
          </div>
        </details>
      </section>
      {!validDate ? (
        <p role="alert" className="text-danger">
          Informe uma data válida até hoje.
        </p>
      ) : (
        <>
          <QueryFeedback
            pending={query.isPending}
            error={error}
            retry={() => void query.refetch()}
          />
          {data && !query.isError && !cascade.stale && (
            <>
              <div className="kpi-grid panel mb-5">
                <section className="kpi-cell">
                  <h2 className="eyebrow">Avanço físico</h2>
                  <p className="kpi-value">
                    {data.overall_percentage === null
                      ? '—'
                      : `${number(data.overall_percentage)}%`}
                  </p>
                  <progress
                    aria-label="Avanço físico geral"
                    value={Number(data.overall_percentage ?? 0)}
                    max={100}
                  />
                  <p className="kpi-caption">
                    Ponderado pelo escopo de produção
                  </p>
                </section>
                <section className="kpi-cell">
                  <h2 className="eyebrow">Não iniciados</h2>
                  <p className="kpi-value">{data.not_started_items}</p>
                  <p className="kpi-caption">
                    <span className="status-badge text-secondary">
                      A iniciar
                    </span>
                  </p>
                </section>
                <section className="kpi-cell">
                  <h2 className="eyebrow">Em andamento</h2>
                  <p className="kpi-value">{data.in_progress_items}</p>
                  <p className="kpi-caption">
                    <span className="status-badge text-info">
                      Execução parcial
                    </span>
                  </p>
                </section>
                <section className="kpi-cell">
                  <h2 className="eyebrow">Concluídos</h2>
                  <p className="kpi-value">
                    {data.completed_items}
                    <span className="ml-2 text-lg font-normal text-secondary">
                      / {data.total_items}
                    </span>
                  </p>
                  <p className="kpi-caption">
                    <span className="status-badge text-success">
                      Execução integral
                    </span>
                  </p>
                </section>
              </div>
              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <section className="panel">
                  <div className="section-heading">
                    <h2>Avanço por disciplina</h2>
                    <span className="font-mono text-xs text-secondary">%</span>
                  </div>
                  {!data.total_items ? (
                    <p className="p-5 text-sm text-secondary">
                      Nenhum item de escopo para os filtros selecionados.
                    </p>
                  ) : (
                    <div className="divide-y divide-line">
                      {data.disciplines.map((group) => (
                        <div key={group.id} className="p-5">
                          <div className="mb-3 flex justify-between gap-3 text-sm">
                            <span className="font-medium">{group.name}</span>
                            <strong className="font-mono text-sm font-medium">
                              {number(group.percentage)}%
                            </strong>
                          </div>
                          <progress
                            aria-label={`Avanço de ${group.name}`}
                            value={Number(group.percentage)}
                            max={100}
                          />
                          <p className="mt-3 text-xs text-secondary">
                            {group.completed_items} de {group.total_items}{' '}
                            elementos concluídos
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="border-t border-line px-5 py-3 text-xs text-secondary">
                    O peso representa esforço e relevância de produção.
                  </p>
                </section>
                <section className="panel overflow-hidden">
                  <div className="section-heading">
                    <h2>Produção por dia e atividade</h2>
                    <Link
                      to="/historico"
                      className="inline-flex min-h-10 items-center text-xs font-medium text-brand-ink"
                    >
                      Ver histórico →
                    </Link>
                  </div>
                  {!data.daily_production.length ? (
                    <p className="p-5 text-sm text-secondary">
                      Nenhuma produção até esta data.
                    </p>
                  ) : (
                    <div
                      className="table-scroll border-0 rounded-none"
                      role="region"
                      aria-label="Produção consolidada"
                      tabIndex={0}
                    >
                      <table className="data-grid">
                        <caption className="sr-only">
                          Produção diária por atividade, com unidades separadas
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Data</th>
                            <th scope="col">Atividade</th>
                            <th scope="col" className="numeric">
                              Produção
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.daily_production.map((row) => (
                            <tr
                              key={`${row.date}:${row.activity_name}:${row.unit}`}
                            >
                              <td className="font-mono text-xs">
                                {dateLabel(row.date)}
                              </td>
                              <td>{row.activity_name}</td>
                              <td className="numeric font-medium">
                                {number(row.quantity)}{' '}
                                <span className="text-secondary">
                                  {units[row.unit]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="border-t border-line px-5 py-3 text-xs text-secondary">
                    Metros quadrados, metros lineares e unidades não são somados
                    entre si.
                  </p>
                </section>
              </div>
              <footer className="mt-5 flex flex-wrap justify-between gap-2 text-[11px] text-secondary">
                <p>
                  Execução física após correções · sem avaliação de prazo ou
                  qualidade.
                </p>
                <p>
                  Atualizado às{' '}
                  <time>
                    {new Date(query.dataUpdatedAt).toLocaleTimeString('pt-BR')}
                  </time>
                </p>
              </footer>
            </>
          )}
        </>
      )}
    </>
  )
}
