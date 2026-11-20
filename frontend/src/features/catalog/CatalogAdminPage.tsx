import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useProjectAccess } from '../auth/access'
import { config } from '../../lib/config'
import { request } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { QueryFeedback } from '../../components/QueryFeedback'
import { UnsavedChangesDialog } from '../../components/UnsavedChangesDialog'
import {
  adminPath,
  catalogs,
  fieldLabels,
  loadCatalogs,
  parents,
  type CatalogKind,
  type CatalogRow,
} from './admin'

export function CatalogAdminPage() {
  const access = useProjectAccess()
  if (access.data?.role !== 'admin')
    return (
      <p role="alert">
        A administração dos cadastros exige perfil de administrador.
      </p>
    )
  if (config.demo)
    return (
      <>
        <PageHeader
          title="Administrar cadastros"
          description="Preparação do escopo da obra"
        />
        <section className="panel p-6">
          <p>
            A criação e edição de cadastros está disponível no ambiente
            conectado à API. A demonstração permite consultar o escopo fictício
            em Cadastros.
          </p>
        </section>
      </>
    )
  return <Administration />
}

function Administration() {
  const [kind, setKind] = useState<CatalogKind>('floors')
  const [selected, setSelected] = useState<CatalogRow | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const attempt = useRef<{ body: string; key: string } | null>(null)
  const catalog = useQuery({
    queryKey: ['admin-catalog', config.projectId],
    queryFn: ({ signal }) => loadCatalogs(signal),
  })
  const audit = useQuery({
    queryKey: ['admin-audit', config.projectId, kind, selected?.id],
    queryFn: ({ signal }) =>
      request<{
        items: {
          id: string
          author_name: string
          reason: string
          action: string
          created_at: string
        }[]
      }>(
        `${adminPath}/audit?entity_type=${kind}${selected ? `&entity_id=${encodeURIComponent(selected.id)}` : ''}`,
        { signal },
      ),
  })
  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string | number> = {
        id: values.id ?? '',
        reason: values.reason ?? '',
      }
      for (const field of catalogs[kind].fields)
        body[field] = values[field] ?? ''
      if (selected) body.expected_version = selected.version
      const serialized = JSON.stringify(body)
      if (attempt.current?.body !== serialized)
        attempt.current = { body: serialized, key: crypto.randomUUID() }
      return request<CatalogRow>(
        `${adminPath}/catalog/${kind}${selected ? `/${encodeURIComponent(selected.id)}` : ''}`,
        {
          method: selected ? 'PUT' : 'POST',
          body: serialized,
          headers: { 'Idempotency-Key': attempt.current.key },
        },
      )
    },
    onSuccess: async () => {
      setDirty(false)
      setValues({})
      setSelected(null)
      attempt.current = null
      setNotice('Cadastro salvo e registrado no histórico de alterações.')
      await queryClient.invalidateQueries()
    },
  })
  function choose(row: CatalogRow | null) {
    setSelected(row)
    setValues(
      row
        ? Object.fromEntries(
            Object.entries(row).map(([key, value]) => [key, String(value)]),
          )
        : {},
    )
    setDirty(false)
    mutation.reset()
    setNotice('')
    attempt.current = null
  }
  function change(field: string, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setDirty(true)
    setNotice('')
    mutation.reset()
  }
  const rows = (catalog.data?.[kind] ?? []).filter((row) =>
    `${row.id} ${row.name ?? ''} ${row.code ?? ''}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  )
  return (
    <>
      <PageHeader
        title="Administrar cadastros"
        description="Organize os locais, serviços e quantidades da obra antes dos apontamentos."
      />
      <UnsavedChangesDialog dirty={dirty} />
      <p className="mb-5 text-sm text-slate-600">
        Cada alteração exige justificativa. Após o primeiro apontamento,
        quantidades, pesos e vínculos do escopo ficam bloqueados.
      </p>
      <QueryFeedback
        pending={catalog.isPending}
        error={catalog.error}
        retry={() => void catalog.refetch()}
      />
      <label className="mb-6 block max-w-sm font-medium">
        Tipo de cadastro
        <select
          value={kind}
          disabled={dirty || mutation.isPending}
          onChange={(event) => {
            setKind(event.target.value as CatalogKind)
            choose(null)
            setSearch('')
          }}
        >
          {Object.entries(catalogs).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
      </label>
      {catalog.isSuccess && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className="panel p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{catalogs[kind].label}</h2>
              <button
                type="button"
                className="button-secondary"
                disabled={dirty || mutation.isPending}
                onClick={() => choose(null)}
              >
                Novo cadastro
              </button>
            </div>
            <label className="block text-sm font-medium">
              Buscar por nome, código ou identificador
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <ul className="mt-4 max-h-96 overflow-auto divide-y divide-slate-200">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">
                      {row.name ?? row.id}
                    </p>
                    <p className="break-words text-sm text-slate-500">
                      {row.id} · versão {row.version}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={dirty || mutation.isPending}
                    aria-label={`Editar ${row.name ?? row.id}`}
                    onClick={() => choose(row)}
                  >
                    Editar
                  </button>
                </li>
              ))}
            </ul>
            {rows.length === 0 && (
              <p className="mt-4 text-slate-600">Nenhum cadastro encontrado.</p>
            )}
          </section>
          <form
            className="panel space-y-4 p-6"
            onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate()
            }}
          >
            <h2 className="text-xl font-semibold">
              {selected ? 'Editar cadastro' : 'Novo cadastro'}
            </h2>
            <fieldset disabled={mutation.isPending} className="space-y-4">
              <label className="block font-medium">
                Identificador
                <input
                  required
                  maxLength={100}
                  disabled={Boolean(selected)}
                  value={values.id ?? ''}
                  onChange={(event) => change('id', event.target.value)}
                />
                <span className="text-xs font-normal text-slate-600">
                  Código único e permanente dentro da obra.
                </span>
              </label>
              {catalogs[kind].fields.map((field) => {
                const parent = parents[field]
                const options =
                  field === 'measurement_type'
                    ? [
                        { id: 'percentage', name: 'Percentual' },
                        { id: 'unit', name: 'Unitária (checklist)' },
                      ]
                    : field === 'unit'
                      ? [
                          { id: 'm2', name: 'm²' },
                          { id: 'm', name: 'Metro linear' },
                          { id: 'un', name: 'Unidade' },
                        ]
                      : parent
                        ? catalog.data[parent]
                        : null
                return (
                  <label key={field} className="block font-medium">
                    {fieldLabels[field]}
                    {options ? (
                      <select
                        required
                        value={values[field] ?? ''}
                        onChange={(event) => change(field, event.target.value)}
                      >
                        <option value="">Selecione</option>
                        {options.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name ?? row.id} · {row.id}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        required
                        maxLength={
                          field === 'code' ? 100 : field === 'name' ? 200 : 30
                        }
                        inputMode={
                          field.includes('quantity') || field.includes('weight')
                            ? 'decimal'
                            : 'text'
                        }
                        value={values[field] ?? ''}
                        onChange={(event) => change(field, event.target.value)}
                      />
                    )}
                  </label>
                )
              })}
              {kind === 'scope-items' && (
                <p className="text-sm text-slate-600">
                  Use ponto nos decimais. Item unitário exige unidade “un” e
                  quantidade prevista 1. O peso representa esforço ou relevância
                  na produção.
                </p>
              )}
              <label className="block font-medium">
                Justificativa
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  value={values.reason ?? ''}
                  onChange={(event) => change('reason', event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  className="button-primary"
                  type="submit"
                  disabled={!dirty || catalog.isFetching}
                >
                  {mutation.isPending ? 'Salvando…' : 'Salvar cadastro'}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => choose(null)}
                >
                  Descartar preenchimento
                </button>
              </div>
            </fieldset>
            {mutation.error && (
              <p role="alert" className="text-red-700">
                {mutation.error.message} Confira o cadastro; para carregar a
                versão atual, descarte o preenchimento e atualize a lista.
              </p>
            )}
            <button
              type="button"
              className="min-h-11 text-sm underline"
              disabled={dirty || mutation.isPending}
              onClick={() => void catalog.refetch()}
            >
              Atualizar lista
            </button>
          </form>
        </div>
      )}
      {notice && (
        <p role="status" className="mt-5 text-green-800">
          {notice}
        </p>
      )}
      <section className="panel mt-6 p-6">
        <h2 className="text-xl font-semibold">
          Últimas alterações {selected ? `· ${selected.id}` : ''}
        </h2>
        <QueryFeedback
          pending={audit.isPending}
          error={audit.error}
          retry={() => void audit.refetch()}
        />
        <ul className="divide-y divide-slate-200">
          {audit.data?.items.map((item) => (
            <li key={item.id} className="py-3">
              <p className="font-medium">
                {item.action === 'create' ? 'Criação' : 'Edição'} ·{' '}
                {item.author_name}
              </p>
              <p>{item.reason}</p>
              <p className="text-sm text-slate-500">
                {new Date(item.created_at).toLocaleString('pt-BR')}
              </p>
            </li>
          ))}
        </ul>
        {audit.isSuccess && audit.data.items.length === 0 && (
          <p className="mt-3 text-slate-600">Nenhuma alteração registrada.</p>
        )}
      </section>
    </>
  )
}
