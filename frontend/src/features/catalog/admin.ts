import { request } from '../../lib/api'
import { config } from '../../lib/config'

export const catalogs = {
  floors: { label: 'Andares', fields: ['name'] },
  environments: { label: 'Ambientes', fields: ['name', 'floor_id'] },
  disciplines: { label: 'Disciplinas', fields: ['name'] },
  activities: { label: 'Atividades', fields: ['name', 'discipline_id'] },
  elements: {
    label: 'Elementos físicos',
    fields: ['name', 'code', 'environment_id'],
  },
  'scope-items': {
    label: 'Escopo de produção',
    fields: [
      'element_id',
      'activity_id',
      'measurement_type',
      'unit',
      'planned_quantity',
      'production_weight',
    ],
  },
  companies: { label: 'Empresas', fields: ['name'] },
} as const
export type CatalogKind = keyof typeof catalogs
export interface CatalogRow {
  id: string
  version: number
  [field: string]: string | number
}
export const fieldLabels: Record<string, string> = {
  name: 'Nome',
  code: 'Código',
  floor_id: 'Andar',
  environment_id: 'Ambiente',
  discipline_id: 'Disciplina',
  element_id: 'Elemento físico',
  activity_id: 'Atividade',
  measurement_type: 'Tipo de medição',
  unit: 'Unidade',
  planned_quantity: 'Quantidade prevista',
  production_weight: 'Peso de produção',
}
export const parents: Record<string, CatalogKind> = {
  floor_id: 'floors',
  environment_id: 'environments',
  discipline_id: 'disciplines',
  element_id: 'elements',
  activity_id: 'activities',
}
export const adminPath = `/projects/${encodeURIComponent(config.projectId)}/admin`
export async function loadCatalogs(signal?: AbortSignal) {
  const entries = await Promise.all(
    (Object.keys(catalogs) as CatalogKind[]).map(async (kind) => {
      const result = await request<{ items: CatalogRow[] }>(
        `${adminPath}/catalog/${kind}`,
        { signal },
      )
      return [kind, result.items] as const
    }),
  )
  return Object.fromEntries(entries) as Record<CatalogKind, CatalogRow[]>
}
