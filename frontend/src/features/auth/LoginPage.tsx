import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { Building2 } from 'lucide-react'
import { config } from '../../lib/config'
import { useAuth } from './context'

export function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const from = location.state?.from
  const target =
    typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    !from.startsWith('/login')
      ? from
      : '/producao'
  if (!auth.loading && auth.session) return <Navigate to={target} replace />
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="panel w-full max-w-md p-7 sm:p-10">
        <Building2
          size={32}
          aria-hidden="true"
          className="mb-8 text-orange-600"
        />
        <p className="eyebrow">CDP CLARO</p>
        <h1 className="mt-2 text-3xl font-semibold">Acesso à obra</h1>
        <p className="mb-7 mt-3 text-slate-600">
          Entre com a conta liberada pela administração.
        </p>
        {config.demo ? (
          <>
            <p className="mb-6 text-sm text-slate-600">
              A demonstração usa dados fictícios e não exige uma conta real.
            </p>
            <Link to="/producao" className="button-primary flex">
              Abrir demonstração
            </Link>
          </>
        ) : !auth.configured ? (
          <p role="alert" className="text-sm text-red-800">
            O acesso ainda não foi configurado. Solicite à equipe a configuração
            do projeto de autenticação.
          </p>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              if (pending) return
              setPending(true)
              setError('')
              try {
                await auth.signIn(email, password)
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : 'Não foi possível entrar.',
                )
              } finally {
                setPending(false)
              }
            }}
          >
            <fieldset disabled={pending || auth.loading} className="grid gap-5">
              <legend className="sr-only">Credenciais</legend>
              <label
                className="grid gap-2 text-sm font-semibold"
                htmlFor="email"
              >
                E-mail
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label
                className="grid gap-2 text-sm font-semibold"
                htmlFor="password"
              >
                Senha
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button className="button-primary" type="submit">
                {pending ? 'Entrando…' : 'Entrar'}
              </button>
            </fieldset>
            {error && (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {error}
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  )
}
