import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../../components/PageHeader'
import { QueryFeedback } from '../../components/QueryFeedback'
import { productionService as service } from '../production/service'
import { number, units } from '../../lib/format'

export function CatalogPage() {
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => service.catalog(signal),
  })
  const rows = (query.data ?? []).filter((item) =>
    `${item.element_code} ${item.element_name} ${item.floor_name} ${item.environment_name} ${item.discipline_name} ${item.activity_name}`
      .toLocaleLowerCase('pt-BR')
      .includes(search.trim().toLocaleLowerCase('pt-BR')),
  )
  return (
    <>
      <PageHeader
        title="Escopo e cadastros"
        description="Confira os elementos, as quantidades previstas e os pesos de produção."
      />
      <section className="panel mb-5 p-5">
        <label
          className="grid gap-2 text-sm font-medium"
          htmlFor="catalog-search"
        >
          Buscar no escopo
          <input
            id="catalog-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Elemento, ambiente, disciplina ou atividade"
          />
        </label>
        <p className="mt-4 text-sm text-slate-600">
          Consulta do escopo cadastrado. Inclusão, importação e revisão de
          quantidades e pesos ainda dependem da definição do fluxo
          administrativo com a engenharia.
        </p>
      </section>
      <QueryFeedback
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.isSuccess && (
        <>
          <p className="mb-4 text-sm text-slate-500">
            {rows.length} elementos encontrados
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((item) => (
              <article key={item.id} className="panel p-5">
                <p className="eyebrow">{item.element_code}</p>
                <h2 className="mt-2 text-lg font-semibold">
                  {item.element_name}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {item.floor_name} · {item.environment_name}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.discipline_name} · {item.activity_name}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Previsto</dt>
                    <dd className="mt-1 font-semibold">
                      {number(item.planned_quantity)} {units[item.unit]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Executado atual</dt>
                    <dd className="mt-1 font-semibold">
                      {number(item.executed_quantity)} {units[item.unit]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Peso de produção</dt>
                    <dd className="mt-1 font-semibold">
                      {number(item.production_weight)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Medição</dt>
                    <dd className="mt-1 font-semibold">
                      {item.measurement_type === 'percentage'
                        ? 'Percentual'
                        : 'Unitária'}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          {!rows.length && (
            <p className="panel p-8 text-slate-600">
              Nenhum elemento encontrado.
            </p>
          )}
        </>
      )}
    </>
  )
}
