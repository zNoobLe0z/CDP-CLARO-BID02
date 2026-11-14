import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Save } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { SelectField } from '../../components/SelectField'
import { productionService as service } from './service'
import {
  buildEntries,
  localDate,
  parsePercentage,
  validateEntry,
} from './measurement'
import type { ProductionBatch, ScopeItem } from './types'

const units = { m2: 'm²', m: 'm', un: 'un' }
const format = (value: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value)

function ElementInput({
  item,
  value,
  onChange,
  disabled,
}: {
  item: ScopeItem
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  const planned = Number(item.planned_quantity)
  const executed = Number(item.executed_quantity)
  const complete = executed >= planned
  const error = validateEntry(
    item,
    item.measurement_type === 'percentage' ? value : '',
  )
  const increment = Number.isFinite(parsePercentage(value))
    ? (planned * parsePercentage(value)) / 100
    : 0
  return (
    <article className="rounded-xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="eyebrow">{item.element_code}</p>
          <h3 className="mt-1 font-semibold">{item.element_name}</h3>
        </div>
        {complete && (
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-700">
            <Check size={16} aria-hidden="true" />
            Concluído
          </span>
        )}
      </div>
      <dl className="my-5 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">Previsto</dt>
          <dd className="mt-1 font-medium">
            {format(planned)} {units[item.unit]}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Executado</dt>
          <dd className="mt-1 font-medium">
            {format(executed)} {units[item.unit]}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Saldo</dt>
          <dd className="mt-1 font-medium">
            {format(planned - executed)} {units[item.unit]}
          </dd>
        </div>
      </dl>
      {item.measurement_type === 'percentage' ? (
        <>
          <label
            className="grid gap-2 text-sm font-medium"
            htmlFor={`item-${item.id}`}
          >
            Avanço adicional do dia (%)
            <input
              id={`item-${item.id}`}
              inputMode="decimal"
              autoComplete="off"
              value={value}
              disabled={disabled || complete}
              onChange={(event) => onChange(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={`feedback-${item.id}`}
              placeholder="Ex.: 25"
            />
          </label>
          <p
            id={`feedback-${item.id}`}
            className={`mt-2 text-sm ${error ? 'text-red-700' : 'text-slate-500'}`}
          >
            {error ??
              (value
                ? `Produção estimada: ${format(increment)} ${units[item.unit]}`
                : 'Percentual sobre a quantidade total prevista.')}
          </p>
        </>
      ) : (
        <label className="flex min-h-12 cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={complete || Boolean(value)}
            disabled={disabled || complete}
            onChange={(event) => onChange(event.target.checked ? '1' : '')}
          />
          {complete ? 'Item já executado' : 'Executado nesta data'}
        </label>
      )}
    </article>
  )
}

export function ProductionPage() {
  const queryClient = useQueryClient()
  const [selection, setSelection] = useState({
    floor: '',
    environment: '',
    discipline: '',
    activity: '',
  })
  const [date, setDate] = useState(localDate)
  const [observation, setObservation] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const submission = useRef<{ payload: string; key: string } | null>(null)
  const inFlight = useRef(false)
  const { floor, environment, discipline, activity } = selection
  const floors = useQuery({
    queryKey: ['production', 'floors'],
    queryFn: ({ signal }) => service.floors(signal),
  })
  const environments = useQuery({
    queryKey: ['production', 'environments', floor],
    queryFn: ({ signal }) => service.environments(floor, signal),
    enabled: Boolean(floor),
  })
  const disciplines = useQuery({
    queryKey: ['production', 'disciplines', environment],
    queryFn: ({ signal }) => service.disciplines(environment, signal),
    enabled: Boolean(environment),
  })
  const activities = useQuery({
    queryKey: ['production', 'activities', environment, discipline],
    queryFn: ({ signal }) =>
      service.activities(environment, discipline, signal),
    enabled: Boolean(environment && discipline),
  })
  const scope = useQuery({
    queryKey: ['production', 'scope', environment, activity],
    queryFn: ({ signal }) => service.scope(environment, activity, signal),
    enabled: Boolean(environment && activity),
  })
  const mutation = useMutation({
    mutationFn: ({ batch, key }: { batch: ProductionBatch; key: string }) =>
      service.save(batch, key),
    onSuccess: async () => {
      setDraft({})
      setObservation('')
      submission.current = null
      setMessage('Apontamento salvo com sucesso.')
      await queryClient.invalidateQueries({ queryKey: ['production', 'scope'] })
    },
    onSettled: () => {
      inFlight.current = false
    },
  })
  function changeSelection(next: typeof selection) {
    setSelection(next)
    setDraft({})
    setMessage('')
    mutation.reset()
    submission.current = null
  }
  function updateDraft(id: string, value: string) {
    setDraft((previous) => ({ ...previous, [id]: value }))
    setMessage('')
    mutation.reset()
  }
  const items = scope.data ?? []
  const invalid = items.some(
    (item) =>
      item.measurement_type === 'percentage' &&
      validateEntry(item, draft[item.id] ?? ''),
  )
  const selectedCount = Object.values(draft).filter((value) =>
    Boolean(value.trim()),
  ).length
  const queryError = [
    floors,
    environments,
    disciplines,
    activities,
    scope,
  ].find((query) => query.isError)
  const dateInvalid = !date || date > localDate()
  return (
    <>
      <PageHeader
        title="Apontar produção"
        description="Selecione a frente de serviço e registre o que foi executado no dia."
      />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (
            inFlight.current ||
            invalid ||
            dateInvalid ||
            !selectedCount ||
            scope.isFetching ||
            queryError
          )
            return
          const batch = {
            execution_date: date,
            observation: observation.trim(),
            entries: buildEntries(items, draft),
          }
          const payload = JSON.stringify(batch)
          if (submission.current?.payload !== payload)
            submission.current = { payload, key: crypto.randomUUID() }
          inFlight.current = true
          setMessage('')
          mutation.mutate({ batch, key: submission.current.key })
        }}
      >
        <fieldset disabled={mutation.isPending} className="panel p-5 sm:p-7">
          <legend className="sr-only">Local e atividade</legend>
          <div className="mb-6 flex items-center gap-3">
            <span className="step">01</span>
            <h2 className="text-lg font-semibold">Frente de serviço</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              id="floor"
              label="Andar"
              value={floor}
              options={floors.data ?? []}
              loading={floors.isFetching}
              onChange={(value) =>
                changeSelection({
                  floor: value,
                  environment: '',
                  discipline: '',
                  activity: '',
                })
              }
            />
            <SelectField
              id="environment"
              label="Ambiente"
              value={environment}
              options={environments.data ?? []}
              disabled={!floor}
              loading={environments.isFetching}
              onChange={(value) =>
                changeSelection({
                  ...selection,
                  environment: value,
                  discipline: '',
                  activity: '',
                })
              }
            />
            <SelectField
              id="discipline"
              label="Disciplina"
              value={discipline}
              options={disciplines.data ?? []}
              disabled={!environment}
              loading={disciplines.isFetching}
              onChange={(value) =>
                changeSelection({
                  ...selection,
                  discipline: value,
                  activity: '',
                })
              }
            />
            <SelectField
              id="activity"
              label="Atividade"
              value={activity}
              options={activities.data ?? []}
              disabled={!discipline}
              loading={activities.isFetching}
              onChange={(value) =>
                changeSelection({ ...selection, activity: value })
              }
            />
          </div>
          {floor &&
            !environments.isFetching &&
            environments.isSuccess &&
            !environments.data.length && (
              <p className="mt-4 text-sm text-slate-600">
                Nenhum ambiente cadastrado neste andar.
              </p>
            )}
          {environment && disciplines.isSuccess && !disciplines.data.length && (
            <p className="mt-4 text-sm text-slate-600">
              Nenhuma disciplina cadastrada neste ambiente.
            </p>
          )}
          {discipline && activities.isSuccess && !activities.data.length && (
            <p className="mt-4 text-sm text-slate-600">
              Nenhuma atividade cadastrada nesta disciplina.
            </p>
          )}
        </fieldset>
        {queryError && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          >
            <p>{queryError.error?.message}</p>
            <button
              type="button"
              className="mt-2 min-h-11 underline"
              onClick={() => void queryError.refetch()}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {!activity ? (
          <div className="my-6 flex items-center gap-3 px-2 text-sm text-slate-500">
            <ArrowRight size={18} aria-hidden="true" />
            <p>Escolha a atividade para visualizar os elementos disponíveis.</p>
          </div>
        ) : (
          <section
            className="panel mt-5 p-5 sm:p-7"
            aria-busy={scope.isFetching}
          >
            <div className="mb-6 flex items-center gap-3">
              <span className="step">02</span>
              <h2 className="text-lg font-semibold">Execução do dia</h2>
            </div>
            <fieldset disabled={mutation.isPending}>
              <legend className="sr-only">Data e elementos executados</legend>
              <label
                htmlFor="execution-date"
                className="mb-6 grid max-w-xs gap-2 text-sm font-semibold"
              >
                Data da execução
                <input
                  id="execution-date"
                  type="date"
                  value={date}
                  max={localDate()}
                  required
                  onChange={(event) => {
                    setDate(event.target.value)
                    mutation.reset()
                    setMessage('')
                  }}
                />
              </label>
              {dateInvalid && (
                <p role="alert" className="mb-4 text-sm text-red-700">
                  Informe uma data válida que não esteja no futuro.
                </p>
              )}
              {scope.isFetching ? (
                <p role="status" className="py-5 text-slate-500">
                  Carregando elementos…
                </p>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {items.map((item) => (
                    <ElementInput
                      key={item.id}
                      item={item}
                      value={draft[item.id] ?? ''}
                      onChange={(value) => updateDraft(item.id, value)}
                      disabled={mutation.isPending}
                    />
                  ))}
                </div>
              )}
              {scope.isSuccess && !scope.isFetching && !items.length && (
                <p className="py-5 text-slate-500">
                  Nenhum elemento cadastrado para esta atividade.
                </p>
              )}
              <label
                htmlFor="observation"
                className="mt-6 grid gap-2 text-sm font-semibold"
              >
                Observação{' '}
                <span className="font-normal text-slate-500">Opcional</span>
                <textarea
                  id="observation"
                  rows={3}
                  maxLength={1000}
                  value={observation}
                  onChange={(event) => {
                    setObservation(event.target.value)
                    mutation.reset()
                    setMessage('')
                  }}
                  placeholder="Informações relevantes sobre a execução"
                />
              </label>
            </fieldset>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
              <p className="text-sm text-slate-500">
                {selectedCount} elemento(s) selecionado(s)
              </p>
              <button
                type="submit"
                className="button-primary flex items-center gap-2"
                disabled={
                  !selectedCount ||
                  invalid ||
                  dateInvalid ||
                  mutation.isPending ||
                  scope.isFetching ||
                  Boolean(queryError)
                }
              >
                <Save size={18} aria-hidden="true" />
                {mutation.isPending ? 'Salvando…' : 'Salvar apontamento'}
              </button>
            </div>
          </section>
        )}
        <div aria-live="polite" className="mt-4">
          {message && <p className="font-medium text-emerald-800">{message}</p>}
        </div>
        {mutation.isError && (
          <p role="alert" className="mt-4 text-red-700">
            {mutation.error.message} Os valores preenchidos foram mantidos.
          </p>
        )}
      </form>
    </>
  )
}
