import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Save } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { UnsavedChangesDialog } from '../../components/UnsavedChangesDialog'
import { ApiError } from '../../lib/api'
import { canEdit, useProjectAccess } from '../auth/access'
import { ScopeCascade } from '../scope/ScopeCascade'
import { useScopeCascade } from '../scope/useScopeCascade'
import { emptySelection } from '../scope/selection'

import { productionService as service } from './service'
import {
  buildEntries,
  localDate,
  parsePercentage,
  validateEntry,
  validExecutionDate,
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
  serverError,
}: {
  item: ScopeItem
  value: string
  onChange: (value: string) => void
  disabled: boolean
  serverError?: string
}) {
  const planned = Number(item.planned_quantity)
  const executed = Number(item.executed_quantity)
  const complete = executed >= planned
  const error =
    serverError ??
    validateEntry(item, item.measurement_type === 'percentage' ? value : '')
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
  const access = useProjectAccess()
  const writable = canEdit(access.data?.role)
  const [selection, setSelection] = useState(emptySelection)
  const [date, setDate] = useState(localDate)
  const [observation, setObservation] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const submission = useRef<{ payload: string; key: string } | null>(null)
  const inFlight = useRef(false)
  const { activity, element } = selection
  const cascade = useScopeCascade(selection)
  const scope = cascade.scope
  const mutation = useMutation({
    mutationFn: ({ batch, key }: { batch: ProductionBatch; key: string }) =>
      service.save(batch, key),
    onSuccess: async () => {
      setDraft({})
      setObservation('')
      submission.current = null
      setMessage('Apontamento salvo com sucesso.')
      await Promise.all(
        ['production', 'history', 'dashboard', 'catalog'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      )
    },
    onSettled: () => {
      inFlight.current = false
    },
  })
  function changeSelection(next: typeof selection) {
    if (
      (Object.values(draft).some((value) => Boolean(value.trim())) ||
        observation.trim()) &&
      !window.confirm(
        'A mudança de local ou atividade descartará o preenchimento. Continuar?',
      )
    )
      return
    setSelection(next)
    setDraft({})
    setObservation('')
    setMessage('')
    mutation.reset()
    submission.current = null
  }
  function updateDraft(id: string, value: string) {
    setDraft((previous) => ({ ...previous, [id]: value }))
    setMessage('')
    mutation.reset()
  }
  const items = cascade.complete
    ? (scope.data ?? []).filter((item) => !element || item.id === element)
    : []
  const invalid = items.some(
    (item) =>
      item.measurement_type === 'percentage' &&
      validateEntry(item, draft[item.id] ?? ''),
  )
  const selectedCount = Object.values(draft).filter((value) =>
    Boolean(value.trim()),
  ).length
  const queryError = cascade.error
  const dateInvalid = !validExecutionDate(date)
  const tooMany = selectedCount > 200
  const serverFields =
    mutation.error instanceof ApiError ? mutation.error.fields : {}
  const serverItemError = (id: string) => {
    const index =
      mutation.variables?.batch.entries.findIndex(
        (entry) => entry.scope_item_id === id,
      ) ?? -1
    return (
      Object.entries(serverFields)
        .filter(([field]) => field.startsWith(`entries.${index}.`))
        .map(([, message]) => message)
        .join(' ') || undefined
    )
  }
  return (
    <>
      <UnsavedChangesDialog
        dirty={
          !mutation.isSuccess &&
          (selectedCount > 0 || Boolean(observation.trim()))
        }
      />
      {access.error && (
        <p role="alert" className="mb-4 text-red-700">
          {access.error.message}
        </p>
      )}
      {!writable && (
        <p className="mb-4 text-sm text-slate-600">
          Seu acesso permite consulta. Solicite permissão para registrar
          produção.
        </p>
      )}
      <PageHeader
        title="Apontar produção"
        description="Selecione a frente de serviço e registre o que foi executado no dia."
      />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (
            !cascade.complete ||
            inFlight.current ||
            invalid ||
            dateInvalid ||
            !selectedCount ||
            scope.isFetching ||
            queryError ||
            !writable ||
            tooMany
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
          <ScopeCascade
            prefix="production"
            selection={selection}
            cascade={cascade}
            onChange={changeSelection}
            required
            disabled={mutation.isPending}
          />
        </fieldset>
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
            <fieldset disabled={mutation.isPending || !writable}>
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
              {serverFields.execution_date && (
                <p role="alert" className="mb-4 text-red-700">
                  {serverFields.execution_date}
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
                      serverError={serverItemError(item.id)}
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
            {serverFields.observation && (
              <p role="alert" className="mt-2 text-red-700">
                {serverFields.observation}
              </p>
            )}
            {tooMany && (
              <p role="alert" className="mt-2 text-red-700">
                Selecione no máximo 200 elementos por lançamento.
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
              <p className="text-sm text-slate-500">
                {selectedCount} elemento(s) selecionado(s)
              </p>
              <button
                type="submit"
                className="button-primary flex items-center gap-2"
                disabled={
                  !cascade.complete ||
                  !selectedCount ||
                  invalid ||
                  dateInvalid ||
                  mutation.isPending ||
                  scope.isFetching ||
                  Boolean(queryError) ||
                  !writable ||
                  tooMany
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
          <div role="alert" className="mt-4 text-red-700">
            {mutation.error.message} Os valores preenchidos foram mantidos.
            {mutation.error instanceof ApiError &&
              mutation.error.status === 409 && (
                <button
                  type="button"
                  className="ml-3 min-h-11 font-semibold underline"
                  onClick={async () => {
                    const refreshed = await scope.refetch()
                    if (refreshed.isError) return
                    mutation.reset()
                    submission.current = null
                    setMessage(
                      'Saldo atualizado. Revise o avanço antes de salvar novamente.',
                    )
                  }}
                >
                  Atualizar saldo
                </button>
              )}
          </div>
        )}
      </form>
    </>
  )
}
