import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { configureAccessToken } from '../../lib/api'
import { config } from '../../lib/config'
import { authClient } from './client'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!config.demo && Boolean(authClient))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authClient || config.demo) return
    const client = authClient
    let previousUser: string | null = null
    configureAccessToken(async () => {
      const { data, error: sessionError } = await client.auth.getSession()
      if (sessionError) return null
      return data.session?.access_token ?? null
    })
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      const user = next?.user.id ?? null
      if (user !== previousUser) {
        void queryClient.cancelQueries()
        queryClient.clear()
        previousUser = user
      }
      setSession(next)
      setLoading(false)
    })
    return () => {
      data.subscription.unsubscribe()
      configureAccessToken(async () => null)
    }
  }, [queryClient])

  async function signIn(email: string, password: string) {
    setError('')
    if (!authClient)
      throw new Error('Configure o acesso da obra antes de entrar.')
    const { error: loginError } = await authClient.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (loginError)
      throw new Error(
        'Não foi possível entrar. Confira seus dados e sua conexão.',
      )
  }
  async function signOut() {
    if (!authClient) return
    const { error: logoutError } = await authClient.auth.signOut({
      scope: 'local',
    })
    if (logoutError) {
      setError('Não foi possível sair. Tente novamente.')
      return
    }
    await queryClient.cancelQueries()
    queryClient.clear()
    setSession(null)
  }
  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        configured: config.demo || Boolean(authClient),
        error,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
