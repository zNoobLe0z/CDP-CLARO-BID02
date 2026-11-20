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
        description="Acompanhe o avanço físico ponderado e a produção registrada na obra."
      />
      <section className="panel mb-6 p-5" aria-label="Filtros do dashboard">
        <label
          htmlFor="reference-date"
          className="mb-5 grid max-w-xs gap-2 text-sm font-semibold"
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
        <ScopeCascade
          prefix="dashboard"
          selection={selection}
          cascade={cascade}
          onChange={setSelection}
        />
      </section>
      <p className="mb-5 text-sm text-slate-500">
        Use os níveis em sequência para detalhar o avanço, ou deixe a seleção
        vazia para consultar a obra. Quantidades de unidades diferentes são
        apresentadas separadamente.
      </p>
      {!validDate ? (
        <p role="alert" className="text-red-700">
          Informe uma data válida até hoje.
        </p>
      ) : (
        <>
          <QueryFeedback
            pending={query.isPending}
            error={error}
            retry={() => {
              void query.refetch()
            }}
          />
          {data && !query.isError && !cascade.stale && (
            <>
              <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  [
                    'Avanço físico',
                    data.overall_percentage === null
                      ? '—'
                      : `${number(data.overall_percentage)}%`,
                  ],
                  ['Não iniciados', data.not_started_items],
                  ['Em andamento', data.in_progress_items],
                  [
                    'Concluídos',
                    `${data.completed_items} / ${data.total_items}`,
                  ],
                ].map(([label, value]) => (
                  <section key={label} className="panel p-5">
                    <h2 className="text-sm text-slate-600">{label}</h2>
                    <p className="mt-3 text-3xl font-semibold tabular-nums">
                      {value}
                    </p>
                  </section>
                ))}
              </div>
              {!data.total_items ? (
                <p className="panel p-7 text-slate-600">
                  Nenhum item de escopo para os filtros selecionados.
                </p>
              ) : (
                <section className="panel p-5 sm:p-7">
                  <h2 className="mb-6 text-lg font-semibold">
                    Avanço por disciplina
                  </h2>
                  <div className="grid gap-6">
                    {data.disciplines.map((group) => (
                      <div key={group.id}>
                        <div className="mb-2 flex justify-between gap-3 text-sm">
                          <span className="font-semibold">{group.name}</span>
                          <span>{number(group.percentage)}%</span>
                        </div>
                        <progress
                          aria-label={`Avanço de ${group.name}`}
                          value={Number(group.percentage)}
                          max={100}
                          className="h-3 w-full accent-slate-800"
                        />
                        <p className="mt-2 text-xs text-slate-500">
                          {group.completed_items} de {group.total_items}{' '}
                          elementos concluídos
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section className="panel mt-6 p-5 sm:p-7">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">
                    Produção por dia e atividade
                  </h2>
                  <Link
                    to="/historico"
                    className="min-h-11 py-3 text-sm font-semibold underline"
                  >
                    Consultar histórico
                  </Link>
                </div>
                {!data.daily_production.length ? (
                  <p className="text-sm text-slate-600">
                    Nenhuma produção até esta data.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {data.daily_production.map((row) => (
                      <li
                        key={`${row.date}:${row.activity_name}:${row.unit}`}
                        className="flex flex-wrap justify-between gap-3 py-4 text-sm"
                      >
                        <span>
                          {dateLabel(row.date)} · {row.activity_name}
                        </span>
                        <strong>
                          {number(row.quantity)} {units[row.unit]}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <p className="mt-5 text-xs text-slate-500">
                Valores válidos após correções, por data de execução. Atualizado
                em {new Date(query.dataUpdatedAt).toLocaleTimeString('pt-BR')}.
                O indicador representa execução física, sem avaliação de prazo
                ou aprovação de qualidade.
              </p>
            </>
          )}
        </>
      )}
    </>
  )
}
