import { act, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './context'

const mock = vi.hoisted(() => ({
  callback: null as ((event: string, session: unknown) => void) | null,
  unsubscribe: vi.fn(),
}))
vi.mock('../../lib/config', () => ({ config: { demo: false } }))
vi.mock('./client', () => ({
  authClient: {
    auth: {
      onAuthStateChange: (callback: typeof mock.callback) => {
        mock.callback = callback
        return { data: { subscription: { unsubscribe: mock.unsubscribe } } }
      },
      getSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

function State() {
  const auth = useAuth()
  return (
    <p>
      {auth.loading ? 'Carregando' : (auth.session?.user.id ?? 'Visitante')}
    </p>
  )
}
it('limpa dados entre usuários e ao encerrar a sessão, sem limpar durante refresh do mesmo usuário', () => {
  const client = new QueryClient()
  const { unmount } = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <State />
      </AuthProvider>
    </QueryClientProvider>,
  )
  expect(screen.getByText('Carregando')).toBeVisible()
  act(() => mock.callback?.('SIGNED_IN', { user: { id: 'user-a' } } as Session))
  client.setQueryData(['private'], 'dados do usuário A')
  act(() =>
    mock.callback?.('TOKEN_REFRESHED', { user: { id: 'user-a' } } as Session),
  )
  expect(client.getQueryData(['private'])).toBe('dados do usuário A')
  act(() => mock.callback?.('SIGNED_IN', { user: { id: 'user-b' } } as Session))
  expect(client.getQueryData(['private'])).toBeUndefined()
  expect(screen.getByText('user-b')).toBeVisible()
  client.setQueryData(['private'], 'dados do usuário B')
  act(() => mock.callback?.('SIGNED_OUT', null))
  expect(client.getQueryData(['private'])).toBeUndefined()
  expect(screen.getByText('Visitante')).toBeVisible()
  unmount()
  expect(mock.unsubscribe).toHaveBeenCalled()
})
