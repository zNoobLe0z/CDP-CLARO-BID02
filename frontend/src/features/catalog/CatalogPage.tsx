import { useSearchParams } from 'react-router'
import { ScopeCascade } from '../scope/ScopeCascade'
import { useScopeCascade } from '../scope/useScopeCascade'
import { emptySelection, scopeFilters, matchesScope } from '../scope/selection'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../../components/PageHeader'
import { QueryFeedback } from '../../components/QueryFeedback'
import { productionService as service } from '../production/service'
import { number, units } from '../../lib/format'

export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('buscar') ?? ''
  const selectedItem = params.get('item')
  function setSearch(value: string) {
    setParams(value ? { buscar: value } : {}, { replace: true })
  }
  const [selection, setSelection] = useState(() => ({
    ...emptySelection,
    floor: params.get('andar') ?? '',
    environment: params.get('ambiente') ?? '',
    discipline: params.get('disciplina') ?? '',
    activity: params.get('atividade') ?? '',
  }))
  const cascade = useScopeCascade(selection)
  const query = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => service.catalog(signal),
  })
  const rows = (query.data ?? []).filter(
    (item) =>
      (selectedItem
        ? item.id === selectedItem
        : matchesScope(item, scopeFilters(selection))) &&
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
        <ScopeCascade
          prefix="catalog"
          selection={selection}
          cascade={cascade}
          onChange={(next) => {
            if (selectedItem) setParams({}, { replace: true })
            setSelection(next)
          }}
        />
      </section>
      <section className="panel mb-5 p-5">
        <label
          className="grid gap-2 text-sm font-medium"
          htmlFor="catalog-search"
        >
          Buscar no escopo
          <input
            id="catalog-search"
            type="search"
            value={
              selectedItem
                ? (query.data?.find((item) => item.id === selectedItem)
                    ?.element_code ?? selectedItem)
                : search
            }
            onChange={(event) => {
              setSelection(emptySelection)
              setSearch(event.target.value)
            }}
            placeholder="Elemento, ambiente, disciplina ou atividade"
          />
        </label>
        <p className="mt-4 text-sm text-secondary">
          Quantidades e pesos definem o avanço físico. Administradores podem
          preparar o catálogo na área Administrar.
        </p>
      </section>
      {selectedItem && (
        <button
          type="button"
          className="button-secondary mb-4"
          onClick={() => {
            setParams({}, { replace: true })
            setSelection(emptySelection)
          }}
        >
          Mostrar todo o escopo
        </button>
      )}
      <QueryFeedback
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.isSuccess && (
        <>
          <p className="mb-4 text-sm text-secondary">
            {rows.length} elementos encontrados
          </p>
          <div
            className="table-scroll"
            role="region"
            aria-label="Tabela de escopo"
            tabIndex={0}
          >
            <table className="data-grid">
              <caption className="sr-only">
                Elementos e quantidades por atividade
              </caption>
              <thead>
                <tr>
                  <th scope="col">Elemento</th>
                  <th scope="col">Local</th>
                  <th scope="col">Atividade</th>
                  <th scope="col" className="numeric">
                    Previsto
                  </th>
                  <th scope="col" className="numeric">
                    Executado
                  </th>
                  <th scope="col" className="numeric">
                    Peso
                  </th>
                  <th scope="col">Medição</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="font-mono text-xs text-brand-ink">
                        {item.element_code}
                      </span>
                      <span className="mt-1 block font-medium">
                        {item.element_name}
                      </span>
                    </td>
                    <td>
                      {item.floor_name}
                      <span className="block text-xs text-secondary">
                        {item.environment_name}
                      </span>
                    </td>
                    <td>
                      {item.activity_name}
                      <span className="block text-xs text-secondary">
                        {item.discipline_name}
                      </span>
                    </td>
                    <td className="numeric">
                      {number(item.planned_quantity)}{' '}
                      <span className="text-secondary">{units[item.unit]}</span>
                    </td>
                    <td className="numeric">
                      {number(item.executed_quantity)}{' '}
                      <span className="text-secondary">{units[item.unit]}</span>
                    </td>
                    <td className="numeric">
                      {number(item.production_weight)}
                    </td>
                    <td>
                      <span className="status-badge text-secondary">
                        {item.measurement_type === 'percentage'
                          ? 'Percentual'
                          : 'Unitária'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p className="panel p-8 text-secondary">
              Nenhum elemento encontrado.
            </p>
          )}
        </>
      )}
    </>
  )
}
