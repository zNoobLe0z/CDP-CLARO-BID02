import { useQuery } from '@tanstack/react-query'
import { request } from '../../lib/api'
import { config } from '../../lib/config'

export interface ProjectAccess {
  user_id: string
  display_name: string
  role: 'admin' | 'editor' | 'viewer'
}
export function canEdit(role: ProjectAccess['role'] | undefined) {
  return role === 'admin' || role === 'editor'
}
export function useProjectAccess() {
  return useQuery({
    queryKey: ['project-access', config.projectId],
    queryFn: async () => {
      if (config.demo)
        return {
          user_id: 'demo',
          display_name: 'Engenharia · demonstração',
          role: 'admin' as const,
        }
      const access = await request<ProjectAccess>(
        `/projects/${encodeURIComponent(config.projectId)}/me`,
      )
      if (!['admin', 'editor', 'viewer'].includes(access.role))
        throw new Error(
          'Perfil de acesso não reconhecido. Solicite a revisão à administração.',
        )
      return access
    },
  })
}
