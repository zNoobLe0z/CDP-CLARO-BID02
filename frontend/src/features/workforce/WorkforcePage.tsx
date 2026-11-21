import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../../components/PageHeader'
import { SelectField } from '../../components/SelectField'
import { QueryFeedback } from '../../components/QueryFeedback'
import { UnsavedChangesDialog } from '../../components/UnsavedChangesDialog'
import { dateLabel } from '../../lib/format'
import { canEdit, useProjectAccess } from '../auth/access'
import { localDate, validExecutionDate } from '../production/measurement'
import {
  workforceService as service,
  type WorkforceInput,
  type WorkforceRecord,
} from './service'

function CountForm({
  date,
  company,
  initial,
  onDirty,
  onSaved,
}: {
  date: string
  company: string
  initial?: WorkforceRecord
  onDirty: (value: boolean) => void
  onSaved: () => void
}) {
  const [quantity, setQuantity] = useState(
    initial ? String(initial.headcount) : '',
  )
  const [observation, setObservation] = useState(initial?.observation ?? '')
  const [baseline, setBaseline] = useState({
    quantity: initial ? String(initial.headcount) : '',
    observation: initial?.observation ?? '',
    version: initial?.version ?? null,
  })
  const [attempt, setAttempt] = useState<{
    payload: string
    key: string
  } | null>(null)
  const queryClient = useQueryClient()
  const dirty =
    quantity !== baseline.quantity || observation !== baseline.observation
  useEffect(() => onDirty(dirty), [dirty, onDirty])
  const mutation = useMutation({
    mutationFn: ({ input, key }: { input: WorkforceInput; key: string }) =>
      service.save(input, key),
    onSuccess: async (saved) => {
      setQuantity(String(saved.headcount))
      setObservation(saved.observation)
      setBaseline({
        quantity: String(saved.headcount),
        observation: saved.observation,
        version: saved.version,
      })
      onSaved()
      await queryClient.invalidateQueries({ queryKey: ['workforce'] })
    },
  })
  const valid =
    /^\d+$/.test(quantity) &&
    Number.isSafeInteger(Number(quantity)) &&
    Number(quantity) <= 100000 &&
    validExecutionDate(date)
  return (
    <>
      <UnsavedChangesDialog dirty={dirty || mutation.isPending} />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!valid || mutation.isPending || !dirty) return
          const input = {
            execution_date: date,
            company_id: company,
            headcount: Number(quantity),
            observation: observation.trim(),
            expected_version: baseline.version,
          }
          const payload = JSON.stringify(input)
          const key =
            attempt?.payload === payload ? attempt.key : crypto.randomUUID()
          setAttempt({ payload, key })
          mutation.mutate({ input, key })
        }}
      >
        <fieldset
          disabled={mutation.isPending}
          className="grid gap-4 sm:grid-cols-2"
        >
          <legend className="sr-only">Contagem de pessoas</legend>
          <label
            className="grid gap-2 text-sm font-semibold"
            htmlFor="headcount"
          >
            Pessoas presentes
            <input
              id="headcount"
              inputMode="numeric"
              required
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value)
                mutation.reset()
              }}
            />
          </label>
          <label
            className="grid gap-2 text-sm font-semibold"
            htmlFor="workforce-observation"
          >
            Observação
            <input
              id="workforce-observation"
              maxLength={1000}
              value={observation}
              onChange={(event) => {
                setObservation(event.target.value)
                mutation.reset()
              }}
            />
          </label>
        </fieldset>
        <p className="my-4 text-sm text-secondary">
          Zero significa que não houve pessoas presentes. Campo vazio significa
          contagem ainda não informada. Ao corrigir, informe a nova contagem
          total do dia.
        </p>
        <button
          type="submit"
          disabled={!valid || !dirty || mutation.isPending}
          className="button-primary"
        >
          {mutation.isPending ? 'Salvando…' : 'Salvar efetivo'}
        </button>
        {mutation.isError && (
          <p role="alert" className="mt-4 text-danger">
            {mutation.error.message} O preenchimento foi mantido. Para atualizar
            um conflito, selecione novamente a empresa e revise a contagem.
          </p>
        )}
      </form>
    </>
  )
}

function Revisions({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['workforce', 'revisions', id],
    queryFn: ({ signal }) => service.revisions(id, signal),
  })
  return (
    <div className="mt-3">
      <QueryFeedback
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.isSuccess &&
        (!query.data.length ? (
          <p className="text-xs text-secondary">Nenhuma revisão anterior.</p>
        ) : (
          <ul className="grid gap-2 text-xs text-secondary">
            {query.data.map((revision) => (
              <li key={revision.version}>
                Versão {revision.version}: {revision.headcount} pessoas ·{' '}
                {revision.author_name} ·{' '}
                {new Date(revision.updated_at).toLocaleString('pt-BR')}
                {revision.observation ? ` · ${revision.observation}` : ''}
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}

export function WorkforcePage() {
  const access = useProjectAccess()
  const [date, setDate] = useState(localDate)
  const [company, setCompany] = useState('')
  const [dirty, setDirty] = useState(false)
  const [success, setSuccess] = useState('')
  const [revisions, setRevisions] = useState('')
  const [period, setPeriod] = useState({
    start_date: `${localDate().slice(0, 8)}01`,
    end_date: localDate(),
    company_id: '',
  })
  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: ({ signal }) => service.companies(signal),
  })
  const validPeriod = Boolean(
    period.start_date &&
    period.end_date &&
    period.start_date <= period.end_date,
  )
  const records = useQuery({
    queryKey: ['workforce', 'list', period],
    queryFn: ({ signal }) => service.list(period, signal),
    enabled: validPeriod,
  })
  const current = useQuery({
    queryKey: ['workforce', 'entry', date, company],
    queryFn: ({ signal }) =>
      service.list(
        { start_date: date, end_date: date, company_id: company },
        signal,
      ),
    enabled: Boolean(company && validExecutionDate(date)),
    refetchOnWindowFocus: false,
  })
  function change(next: () => void) {
    if (
      dirty &&
      !window.confirm('A mudança descartará a contagem não salva. Continuar?')
    )
      return
    setDirty(false)
    setSuccess('')
    next()
  }
  const days = [
    ...new Set(records.data?.map((record) => record.execution_date) ?? []),
  ]
    .sort()
    .reverse()
  return (
    <>
      <PageHeader
        title="Efetivo"
        description="Registre o número de pessoas presentes por empresa e dia."
      />
      {canEdit(access.data?.role) && (
        <section className="panel mb-6 p-5">
          <h2 className="mb-5 text-base font-semibold">Contagem diária</h2>
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <label
              className="grid gap-2 text-sm font-semibold"
              htmlFor="workforce-date"
            >
              Data da contagem
              <input
                id="workforce-date"
                type="date"
                value={date}
                max={localDate()}
                onChange={(event) => change(() => setDate(event.target.value))}
              />
            </label>
            <SelectField
              id="workforce-company"
              label="Empresa da contagem"
              value={company}
              options={companies.data ?? []}
              onChange={(value) => change(() => setCompany(value))}
            />
          </div>
          {company && !validExecutionDate(date) && (
            <p role="alert" className="text-danger">
              Informe uma data válida até hoje.
            </p>
          )}
          {company && validExecutionDate(date) && (
            <>
              <QueryFeedback
                pending={current.isPending}
                error={current.error}
                retry={() => void current.refetch()}
              />
              {current.isSuccess && (
                <CountForm
                  key={`${date}:${company}`}
                  date={date}
                  company={company}
                  initial={current.data[0]}
                  onDirty={setDirty}
                  onSaved={() => setSuccess('Efetivo salvo com sucesso.')}
                />
              )}
            </>
          )}
          <p role="status" className="mt-4 text-success">
            {success}
          </p>
        </section>
      )}
      <section className="panel p-5">
        <h2 className="mb-5 text-base font-semibold">Consulta de efetivo</h2>
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <label
            htmlFor="workforce-start"
            className="grid gap-2 text-sm font-medium"
          >
            De
            <input
              id="workforce-start"
              type="date"
              value={period.start_date}
              onChange={(event) =>
                setPeriod((current) => ({
                  ...current,
                  start_date: event.target.value,
                }))
              }
            />
          </label>
          <label
            htmlFor="workforce-end"
            className="grid gap-2 text-sm font-medium"
          >
            Até
            <input
              id="workforce-end"
              type="date"
              value={period.end_date}
              onChange={(event) =>
                setPeriod((current) => ({
                  ...current,
                  end_date: event.target.value,
                }))
              }
            />
          </label>
          <SelectField
            id="workforce-filter-company"
            label="Empresa"
            value={period.company_id}
            options={companies.data ?? []}
            emptyLabel="Todas"
            onChange={(value) =>
              setPeriod((current) => ({ ...current, company_id: value }))
            }
          />
        </div>
        {!validPeriod ? (
          <p role="alert" className="text-danger">
            Informe um período válido.
          </p>
        ) : (
          <>
            <QueryFeedback
              pending={records.isPending || companies.isPending}
              error={records.error ?? companies.error}
              retry={() => {
                void records.refetch()
                void companies.refetch()
              }}
            />
            {records.isSuccess && companies.isSuccess && (
              <div className="grid gap-4">
                {days.map((day) => (
                  <article
                    key={day}
                    className="rounded-md border border-line p-4"
                  >
                    <h3 className="font-semibold">{dateLabel(day)}</h3>
                    <p className="my-2 text-sm text-secondary">
                      Total informado no dia:{' '}
                      {records.data
                        .filter((record) => record.execution_date === day)
                        .reduce(
                          (total, record) => total + record.headcount,
                          0,
                        )}{' '}
                      pessoas
                    </p>
                    <ul className="divide-y divide-line">
                      {companies.data
                        .filter(
                          (item) =>
                            !period.company_id || item.id === period.company_id,
                        )
                        .map((item) => {
                          const record = records.data.find(
                            (row) =>
                              row.execution_date === day &&
                              row.company_id === item.id,
                          )
                          return (
                            <li key={item.id} className="py-3 text-sm">
                              <div className="flex justify-between gap-3">
                                <span>{item.name}</span>
                                <strong>
                                  {record
                                    ? `${record.headcount} pessoas`
                                    : 'Não informado'}
                                </strong>
                              </div>
                              {record && (
                                <>
                                  <p className="mt-1 text-xs text-secondary">
                                    {record.author_name} · versão{' '}
                                    {record.version}
                                    {record.observation
                                      ? ` · ${record.observation}`
                                      : ''}
                                  </p>
                                  <button
                                    type="button"
                                    className="min-h-10 text-xs underline"
                                    onClick={() =>
                                      setRevisions((current) =>
                                        current === record.id ? '' : record.id,
                                      )
                                    }
                                  >
                                    {revisions === record.id
                                      ? 'Ocultar revisões'
                                      : 'Ver revisões'}
                                  </button>
                                  {revisions === record.id && (
                                    <Revisions id={record.id} />
                                  )}
                                </>
                              )}
                            </li>
                          )
                        })}
                    </ul>
                  </article>
                ))}
              </div>
            )}
            {records.isSuccess && !records.data.length && (
              <p className="text-sm text-secondary">
                Nenhuma contagem informada no período.
              </p>
            )}
          </>
        )}
        <p className="mt-5 text-xs text-secondary">
          A consulta mostra dias com ao menos uma contagem informada. Não
          representa funcionários únicos nem produtividade. Não há soma de
          pessoas entre dias.
        </p>
      </section>
    </>
  )
}
