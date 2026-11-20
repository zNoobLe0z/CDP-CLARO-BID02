import { useQuery } from '@tanstack/react-query'
import { config } from '../../lib/config'
import { productionService as service } from '../production/service'
import { levels, type ScopeSelection } from './selection'

export function useScopeCascade(selection: ScopeSelection) {
  const { floor, environment, discipline, activity } = selection
  const base = ['production', 'cascade', config.projectId]
  const floors = useQuery({
    queryKey: [...base, 'floors'],
    queryFn: ({ signal }) => service.floors(signal),
  })
  const floorValid = Boolean(
    floor && floors.data?.some((option) => option.id === floor),
  )
  const environments = useQuery({
    queryKey: [...base, 'environments', floor],
    queryFn: ({ signal }) => service.environments(floor, signal),
    enabled: floorValid,
  })
  const environmentValid = Boolean(
    floorValid &&
    environment &&
    environments.data?.some((option) => option.id === environment),
  )
  const disciplines = useQuery({
    queryKey: [...base, 'disciplines', floor, environment],
    queryFn: ({ signal }) => service.disciplines(environment, signal),
    enabled: environmentValid,
  })
  const disciplineValid = Boolean(
    environmentValid &&
    discipline &&
    disciplines.data?.some((option) => option.id === discipline),
  )
  const activities = useQuery({
    queryKey: [...base, 'activities', floor, environment, discipline],
    queryFn: ({ signal }) =>
      service.activities(environment, discipline, signal),
    enabled: disciplineValid,
  })
  const activityValid = Boolean(
    disciplineValid &&
    activity &&
    activities.data?.some((option) => option.id === activity),
  )
  const scope = useQuery({
    queryKey: [...base, 'scope', floor, environment, discipline, activity],
    queryFn: ({ signal }) => service.scope(environment, activity, signal),
    enabled: activityValid,
  })
  const options = [
    floors.data ?? [],
    environments.data ?? [],
    disciplines.data ?? [],
    activities.data ?? [],
    (scope.data ?? []).map((item) => ({
      id: item.id,
      name: `${item.element_code} · ${item.element_name}`,
    })),
  ]
  const queries = [floors, environments, disciplines, activities, scope]
  const enabled = [
    true,
    floorValid,
    environmentValid,
    disciplineValid,
    activityValid,
  ]
  const error = queries.find((query, index) => enabled[index] && query.isError)
  const stale = levels.some(
    (level, index) =>
      Boolean(selection[level]) &&
      (!enabled[index] ||
        (queries[index].isSuccess &&
          !options[index].some((option) => option.id === selection[level]))),
  )
  const fetching = queries.some(
    (query, index) => enabled[index] && query.isFetching,
  )
  return {
    options,
    queries,
    enabled,
    scope,
    error,
    stale,
    fetching,
    complete: activityValid && scope.isSuccess && !fetching && !error && !stale,
  }
}
