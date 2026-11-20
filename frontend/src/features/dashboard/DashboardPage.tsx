import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { SelectField } from '../../components/SelectField'
import { QueryFeedback } from '../../components/QueryFeedback'
import { productionService as service } from '../production/service'
import { localDate, validExecutionDate } from '../production/measurement'
import { dateLabel, number, units } from '../../lib/format'

export function DashboardPage() {
  const [filters, setFilters] = useState({
    reference_date: localDate(),
    floor_id: '',
    environment_id: '',
    discipline_id: '',
  })
  const catalog = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => service.catalog(signal),
  })
  const floors = useQuery({
    queryKey: ['production', 'floors'],
    queryFn: ({ signal }) => service.floors(signal),
  })
  const validDate = validExecutionDate(filters.reference_date)
  const query = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: ({ signal }) => service.dashboard(filters, signal),
    enabled: validDate,
  })
  const options = (kind: 'environment' | 'discipline') => [
    ...new Map(
      (catalog.data ?? [])
        .filter(
          (item) =>
            (!filters.floor_id || item.floor_id === filters.floor_id) &&
            (kind === 'environment' ||
              !filters.environment_id ||
              item.environment_id === filters.environment_id),
        )
        .map((item) => [
          item[`${kind}_id`],
          { id: item[`${kind}_id`], name: item[`${kind}_name`] },
        ]),
    ).values(),
  ]
  const data = query.data
  const error = query.error ?? catalog.error ?? floors.error
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Acompanhe o avanço físico ponderado e a produção registrada na obra."
      />
      <section
        className="panel mb-6 grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Filtros do dashboard"
      >
        <label
          htmlFor="reference-date"
          className="grid gap-2 text-sm font-semibold"
        >
          Acumulado até
          <input
            id="reference-date"
            type="date"
            max={localDate()}
            value={filters.reference_date}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                reference_date: event.target.value,
              }))
            }
          />
        </label>
        <SelectField
          id="dashboard-floor"
          emptyLabel="Todos"
          label="Andar"
          value={filters.floor_id}
          options={floors.data ?? []}
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              floor_id: value,
              environment_id: '',
              discipline_id: '',
            }))
          }
        />
        <SelectField
          id="dashboard-environment"
          emptyLabel="Todos"
          label="Ambiente"
          value={filters.environment_id}
          options={options('environment')}
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              environment_id: value,
              discipline_id: '',
            }))
          }
        />
        <SelectField
          id="dashboard-discipline"
          emptyLabel="Todas"
          label="Disciplina"
          value={filters.discipline_id}
          options={options('discipline')}
          onChange={(value) =>
            setFilters((current) => ({ ...current, discipline_id: value }))
          }
        />
      </section>
      <p className="mb-5 text-sm text-slate-500">
        Selecione a opção “Todos” para consultar todo o escopo. Quantidades de
        unidades diferentes são apresentadas separadamente.
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
              void catalog.refetch()
              void floors.refetch()
            }}
          />
          {data && !query.isError && (
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
