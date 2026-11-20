import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { config } from '../../lib/config'
import { useAuth } from './context'

export function RequireSession({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  if (config.demo) return children
  if (auth.loading)
    return (
      <p role="status" className="p-8">
        Verificando sessão…
      </p>
    )
  if (!auth.session)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  return children
}
