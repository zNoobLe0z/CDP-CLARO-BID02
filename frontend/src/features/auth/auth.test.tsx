import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthContext, type AuthState } from './context'
import { LoginPage } from './LoginPage'
import { RequireSession } from './RequireSession'

vi.mock('../../lib/config', () => ({ config: { demo: false } }))
const state: AuthState = {
  session: null,
  configured: true,
  loading: false,
  error: '',
  signIn: vi.fn(),
  signOut: vi.fn(),
}
it('redireciona visitante e preserva o destino', async () => {
  render(
    <AuthContext.Provider value={state}>
      <MemoryRouter initialEntries={['/historico']}>
        <Routes>
          <Route
            path="/historico"
            element={
              <RequireSession>
                <p>Privado</p>
              </RequireSession>
            }
          />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  expect(
    await screen.findByRole('heading', { name: 'Acesso à obra' }),
  ).toBeVisible()
  expect(screen.queryByText('Privado')).not.toBeInTheDocument()
})
it('permite gerenciador de senhas e mantém e-mail após falha', async () => {
  const signIn = vi.fn().mockRejectedValue(new Error('Falha de conexão'))
  render(
    <AuthContext.Provider value={{ ...state, signIn }}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('E-mail'), 'obra@example.com')
  await user.type(screen.getByLabelText('Senha'), 'secret123')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha de conexão')
  expect(screen.getByLabelText('E-mail')).toHaveValue('obra@example.com')
  expect(screen.getByLabelText('Senha')).toHaveAttribute(
    'autocomplete',
    'current-password',
  )
})
