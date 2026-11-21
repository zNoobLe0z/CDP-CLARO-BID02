import { ScopeCascade } from '../scope/ScopeCascade'
import { useScopeCascade } from '../scope/useScopeCascade'
import { emptySelection, scopeFilters } from '../scope/selection'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../../components/PageHeader'
import { QueryFeedback } from '../../components/QueryFeedback'
import { dateLabel, number, units } from '../../lib/format'
import { productionService as service } from './service'
import type {
  Correction,
  HistoryFilters,
  ProductionRecord,
} from './history-types'
import { canEdit, useProjectAccess } from '../auth/access'

function CorrectionForm({
  record,
  onClose,
  onSaved,
}: {
  record: ProductionRecord
  onClose: () => void
  onSaved: () => void
}) {
  const [quantity, setQuantity] = useState(record.quantity)
  const [reason, setReason] = useState('')
  const [attempt, setAttempt] = useState<{
    payload: string
    key: string
  } | null>(null)
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({
      correction,
      key,
    }: {
      correction: Correction
      key: string
    }) => service.correct(record.id, correction, key),
    onSuccess: async () => {
      await Promise.all(
        ['history', 'dashboard', 'catalog', 'production'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      )
      onSaved()
    },
  })
  const normalized = quantity.trim().replace(',', '.')
  const valid =
    /^\d+(\.\d{1,6})?$/.test(normalized) &&
    Number(normalized) >= 0 &&
    (record.measurement_type !== 'unit' || ['0', '1'].includes(normalized)) &&
    reason.trim().length >= 5 &&
    Number(normalized) !== Number(record.quantity)
  return (
    <section
      className="panel mb-6 border-brand-ink p-5"
      aria-labelledby="correction-heading"
    >
      <h2 id="correction-heading" className="text-base font-semibold">
        Corrigir {record.element_code}
      </h2>
      <p className="my-3 text-sm text-secondary">
        Informe a quantidade correta deste registro, não o total acumulado do
        elemento. O original permanece no histórico. Use zero para anular a
        produção deste registro.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!valid || mutation.isPending) return
          const correction = {
            quantity: normalized,
            reason: reason.trim(),
            expected_record_version: record.version,
            expected_scope_version: record.scope_version,
          }
          const payload = JSON.stringify(correction)
          const key =
            attempt?.payload === payload ? attempt.key : crypto.randomUUID()
          setAttempt({ payload, key })
          mutation.mutate({ correction, key })
        }}
      >
        <fieldset
          disabled={mutation.isPending}
          className="grid gap-4 sm:grid-cols-2"
        >
          <legend className="sr-only">Correção de quantidade</legend>
          <label
            className="grid gap-2 text-sm font-medium"
            htmlFor="corrected-quantity"
          >
            Quantidade correta ({units[record.unit]})
            <input
              id="corrected-quantity"
              inputMode="decimal"
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <label
            className="grid gap-2 text-sm font-medium"
            htmlFor="correction-reason"
          >
            Justificativa
            <input
              id="correction-reason"
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={!valid || mutation.isPending}
            className="button-primary"
          >
            {mutation.isPending ? 'Salvando correção…' : 'Confirmar correção'}
          </button>
          <button
            type="button"
            className="min-h-10 px-3 underline"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
        {mutation.isError && (
          <p role="alert" className="mt-3 text-danger">
            {mutation.error.message} Feche e reabra a correção após atualizar o
            histórico caso o saldo tenha mudado.
          </p>
        )}
      </form>
    </section>
  )
}

const initialFilters: HistoryFilters = {
  page: 1,
  page_size: 10,
  start_date: '',
  end_date: '',
  search: '',
  status: '',
}
export function HistoryPage() {
  const access = useProjectAccess()
  const [filters, setFilters] = useState(initialFilters)
  const [selection, setSelection] = useState(emptySelection)
  const cascade = useScopeCascade(selection)
  const scopedFilters = { ...filters, ...scopeFilters(selection) }
  const [editing, setEditing] = useState<ProductionRecord | null>(null)
  const [success, setSuccess] = useState('')
  const invalidRange = Boolean(
    filters.start_date &&
    filters.end_date &&
    filters.start_date > filters.end_date,
  )
  const query = useQuery({
    queryKey: ['history', scopedFilters],
    queryFn: ({ signal }) => service.history(scopedFilters, signal),
    enabled: !invalidRange && !cascade.stale,
  })
  function filter(patch: Partial<HistoryFilters>) {
    setFilters((current) => ({ ...current, ...patch, page: 1 }))
    setEditing(null)
    setSuccess('')
  }
  return (
    <>
      <PageHeader
        title="Histórico de produção"
        description="Consulte os apontamentos e mantenha as correções rastreáveis."
      />
      <section className="panel mb-5 p-5" aria-label="Local do histórico">
        <ScopeCascade
          prefix="history"
          selection={selection}
          cascade={cascade}
          onChange={(next) => {
            setSelection(next)
            filter({})
          }}
        />
      </section>
      <section
        className="panel mb-5 grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Filtros do histórico"
      >
        <label
          className="grid gap-2 text-sm font-medium"
          htmlFor="history-search"
        >
          Buscar elemento ou atividade
          <input
            id="history-search"
            type="search"
            value={filters.search}
            onChange={(event) => filter({ search: event.target.value })}
          />
        </label>
        <label
          className="grid gap-2 text-sm font-medium"
          htmlFor="history-start"
        >
          De
          <input
            id="history-start"
            type="date"
            value={filters.start_date}
            onChange={(event) => filter({ start_date: event.target.value })}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium" htmlFor="history-end">
          Até
          <input
            id="history-end"
            type="date"
            value={filters.end_date}
            onChange={(event) => filter({ end_date: event.target.value })}
          />
        </label>
        <label
          className="grid gap-2 text-sm font-medium"
          htmlFor="history-status"
        >
          Situação
          <select
            id="history-status"
            value={filters.status}
            onChange={(event) =>
              filter({ status: event.target.value as HistoryFilters['status'] })
            }
          >
            <option value="">Todas</option>
            <option value="active">Válidos</option>
            <option value="corrected">Substituídos</option>
          </select>
        </label>
      </section>
      {invalidRange && (
        <p role="alert" className="mb-4 text-danger">
          A data inicial deve ser anterior ou igual à final.
        </p>
      )}
      {editing && (
        <CorrectionForm
          key={editing.id}
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setSuccess(
              'Correção registrada. O apontamento original foi preservado.',
            )
          }}
        />
      )}
      <p role="status" className="mb-4 text-success">
        {success}
      </p>
      {!invalidRange && !cascade.stale && (
        <>
          <QueryFeedback
            pending={query.isPending}
            error={query.error}
            retry={() => void query.refetch()}
          />
          {query.isSuccess && (
            <>
              <div className="history-list">
                {query.data.items.map((record) => (
                  <article className="history-record" key={record.id}>
                    <div className="min-w-0">
                      <p className="mb-1 font-mono text-[11px] text-secondary">
                        {record.element_code} ·{' '}
                        {dateLabel(record.execution_date)}
                      </p>
                      <h2 className="text-sm font-semibold">
                        {record.activity_name} · {record.element_name}
                      </h2>
                      <p className="mt-1 text-xs text-secondary">
                        {record.environment_name} · {record.author_name}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`status-badge ${record.status === 'active' ? 'text-success' : 'text-warning'}`}
                      >
                        {record.status === 'active' ? 'Válido' : 'Substituído'}
                      </span>
                      <p className="record-quantity">
                        {number(record.quantity)}{' '}
                        <span className="text-xs font-normal text-secondary">
                          {units[record.unit]}
                        </span>
                      </p>
                    </div>
                    <details className="record-details">
                      <summary>Detalhes do apontamento</summary>
                      <div className="grid gap-2 pb-2">
                        {record.observation && (
                          <p>Observação: {record.observation}</p>
                        )}
                        {record.correction_reason && (
                          <p>Justificativa: {record.correction_reason}</p>
                        )}
                        {record.replaces_id && (
                          <p className="break-all">
                            Substitui o registro{' '}
                            <code>{record.replaces_id}</code>
                          </p>
                        )}
                        <p className="break-all">
                          Registro <code>{record.id}</code>
                        </p>
                        <p>
                          {new Date(record.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </details>
                    {record.status === 'active' &&
                      canEdit(access.data?.role) && (
                        <button
                          className="col-span-2 justify-self-start min-h-10 text-xs font-medium text-brand-ink"
                          type="button"
                          onClick={() => {
                            setEditing(record)
                            setSuccess('')
                          }}
                        >
                          Corrigir {record.element_code}
                        </button>
                      )}
                  </article>
                ))}
              </div>
              {!query.data.total && (
                <p className="panel p-8 text-secondary">
                  Nenhum apontamento encontrado para os filtros selecionados.
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-secondary">
                  {query.data.total} registros · Página {filters.page} de{' '}
                  {Math.max(1, Math.ceil(query.data.total / filters.page_size))}
                </p>
                <div className="flex gap-3">
                  <button
                    className="button-secondary"
                    disabled={filters.page === 1}
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        page: current.page - 1,
                      }))
                    }
                  >
                    Anterior
                  </button>
                  <button
                    className="button-secondary"
                    disabled={
                      filters.page * filters.page_size >= query.data.total
                    }
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        page: current.page + 1,
                      }))
                    }
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}
