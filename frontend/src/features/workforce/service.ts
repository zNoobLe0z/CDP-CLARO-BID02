import { ApiError, request } from '../../lib/api'
import { config } from '../../lib/config'
import { localDate, validExecutionDate } from '../production/measurement'
import type { Option } from '../production/types'

export interface WorkforceRecord {
  id: string
  company_id: string
  company_name: string
  execution_date: string
  headcount: number
  observation: string
  author_name: string
  updated_at: string
  version: number
}
export interface WorkforceRevision {
  version: number
  headcount: number
  observation: string
  author_name: string
  updated_at: string
}
export interface WorkforceInput {
  execution_date: string
  company_id: string
  headcount: number
  observation: string
  expected_version: number | null
}
export interface WorkforceFilters {
  start_date: string
  end_date: string
  company_id: string
}
export interface WorkforceService {
  companies(signal?: AbortSignal): Promise<Option[]>
  list(
    filters: WorkforceFilters,
    signal?: AbortSignal,
  ): Promise<WorkforceRecord[]>
  save(input: WorkforceInput, key: string): Promise<WorkforceRecord>
  revisions(id: string, signal?: AbortSignal): Promise<WorkforceRevision[]>
}

export function createWorkforceDemo(): WorkforceService {
  const companies = [
    { id: 'company-a', name: 'Equipe Alfa' },
    { id: 'company-b', name: 'Equipe Beta' },
  ]
  let records: WorkforceRecord[] = [
    {
      id: 'workforce-initial',
      company_id: 'company-a',
      company_name: 'Equipe Alfa',
      execution_date: localDate(),
      headcount: 8,
      observation: 'Contagem de demonstração',
      author_name: 'Engenharia · demonstração',
      updated_at: new Date().toISOString(),
      version: 1,
    },
  ]
  const revisions = new Map<string, WorkforceRevision[]>()
  const replays = new Map<
    string,
    { payload: string; result: WorkforceRecord }
  >()
  return {
    companies: async () => structuredClone(companies),
    list: async (filters) =>
      structuredClone(
        records
          .filter(
            (record) =>
              record.execution_date >= filters.start_date &&
              record.execution_date <= filters.end_date &&
              (!filters.company_id || record.company_id === filters.company_id),
          )
          .sort(
            (a, b) =>
              b.execution_date.localeCompare(a.execution_date) ||
              a.company_name.localeCompare(b.company_name),
          ),
      ),
    revisions: async (id) => structuredClone(revisions.get(id) ?? []),
    save: async (input, key) => {
      const payload = JSON.stringify(input)
      const replay = replays.get(key)
      if (replay) {
        if (replay.payload !== payload)
          throw new ApiError(
            'Chave já usada com outra contagem.',
            409,
            'IDEMPOTENCY_CONFLICT',
          )
        return structuredClone(replay.result)
      }
      const company = companies.find((item) => item.id === input.company_id)
      if (
        !company ||
        !validExecutionDate(input.execution_date) ||
        !Number.isSafeInteger(input.headcount) ||
        input.headcount < 0 ||
        input.headcount > 100000 ||
        input.observation.length > 1000
      )
        throw new ApiError(
          'Revise a empresa, a data e a contagem.',
          422,
          'VALIDATION_ERROR',
        )
      const current = records.find(
        (record) =>
          record.execution_date === input.execution_date &&
          record.company_id === input.company_id,
      )
      if ((current?.version ?? null) !== input.expected_version)
        throw new ApiError(
          'A contagem foi alterada. Atualize os dados antes de tentar novamente.',
          409,
          'WORKFORCE_VERSION_CONFLICT',
        )
      const saved = {
        id: current?.id ?? crypto.randomUUID(),
        company_id: company.id,
        company_name: company.name,
        execution_date: input.execution_date,
        headcount: input.headcount,
        observation: input.observation,
        author_name: 'Engenharia · demonstração',
        updated_at: new Date().toISOString(),
        version: (current?.version ?? 0) + 1,
      }
      if (current)
        revisions.set(current.id, [
          ...(revisions.get(current.id) ?? []),
          {
            version: current.version,
            headcount: current.headcount,
            observation: current.observation,
            author_name: current.author_name,
            updated_at: current.updated_at,
          },
        ])
      records = [...records.filter((record) => record.id !== saved.id), saved]
      replays.set(key, { payload, result: saved })
      return structuredClone(saved)
    },
  }
}

const project = `/projects/${encodeURIComponent(config.projectId)}`
const api: WorkforceService = {
  companies: async (signal) =>
    (await request<{ items: Option[] }>(`${project}/companies`, { signal }))
      .items,
  list: async (filters, signal) =>
    (
      await request<{ items: WorkforceRecord[] }>(
        `${project}/workforce?${new URLSearchParams({ ...filters })}`,
        { signal },
      )
    ).items,
  save: (input, key) =>
    request<WorkforceRecord>(
      `${project}/workforce/${input.execution_date}/${encodeURIComponent(input.company_id)}`,
      {
        method: 'PUT',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({
          headcount: input.headcount,
          observation: input.observation,
          expected_version: input.expected_version,
        }),
      },
    ),
  revisions: async (id, signal) =>
    (
      await request<{ items: WorkforceRevision[] }>(
        `${project}/workforce-records/${encodeURIComponent(id)}/revisions`,
        { signal },
      )
    ).items,
}
export const workforceService = config.demo ? createWorkforceDemo() : api
