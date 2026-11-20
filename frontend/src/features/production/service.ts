import { config } from '../../lib/config'
import { request } from '../../lib/api'
import { createDemoService } from './demo-service'
import type { BatchResult, Option, ProductionService, ScopeItem } from './types'
import type {
  CatalogItem,
  HistoryPage,
  HistoryService,
  ProductionRecord,
} from './history-types'

const project = `/projects/${encodeURIComponent(config.projectId)}`
const query = (values: Record<string, string>) =>
  new URLSearchParams(values).toString()
const list = async <T>(path: string, signal?: AbortSignal) =>
  (await request<{ items: T[] }>(path, { signal })).items
const api: ProductionService & HistoryService = {
  catalog: (signal) => list<CatalogItem>(`${project}/scope-catalog`, signal),
  history: (filters, signal) =>
    request<HistoryPage>(
      `${project}/production-records?${new URLSearchParams(
        Object.entries(filters)
          .filter(([, value]) => value !== '')
          .map(([key, value]) => [key, String(value)]),
      ).toString()}`,
      { signal },
    ),
  correct: (id, correction, key) =>
    request<ProductionRecord>(
      `${project}/production-records/${encodeURIComponent(id)}/corrections`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify(correction),
      },
    ),
  floors: (signal) => list<Option>(`${project}/floors`, signal),
  environments: (floorId, signal) =>
    list<Option>(
      `${project}/environments?${query({ floor_id: floorId })}`,
      signal,
    ),
  disciplines: (environmentId, signal) =>
    list<Option>(
      `${project}/disciplines?${query({ environment_id: environmentId })}`,
      signal,
    ),
  activities: (environmentId, disciplineId, signal) =>
    list<Option>(
      `${project}/activities?${query({ environment_id: environmentId, discipline_id: disciplineId })}`,
      signal,
    ),
  scope: (environmentId, activityId, signal) =>
    list<ScopeItem>(
      `${project}/scope-items?${query({ environment_id: environmentId, activity_id: activityId })}`,
      signal,
    ),
  save: (batch, key) =>
    request<BatchResult>(`${project}/production-batches`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(batch),
    }),
}
export const productionService = config.demo ? createDemoService() : api
