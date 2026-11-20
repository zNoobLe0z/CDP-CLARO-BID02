import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router'
import {
  Building2,
  ChartNoAxesCombined,
  ClipboardList,
  Database,
  Menu,
  Users,
  X,
  History,
} from 'lucide-react'
import { config } from './lib/config'
import { ProductionPage } from './features/production/ProductionPage'
import { PageHeader } from './components/PageHeader'
import { LoginPage } from './features/auth/LoginPage'
import { RequireSession } from './features/auth/RequireSession'
import { useAuth } from './features/auth/context'
import { HistoryPage } from './features/production/HistoryPage'
import { useProjectAccess } from './features/auth/access'
import { QueryFeedback } from './components/QueryFeedback'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { WorkforcePage } from './features/workforce/WorkforcePage'
import { CatalogPage } from './features/catalog/CatalogPage'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: ChartNoAxesCombined },
  { to: '/producao', label: 'Produção', icon: ClipboardList },
  { to: '/historico', label: 'Histórico', icon: History },
  { to: '/efetivo', label: 'Efetivo', icon: Users },
  { to: '/cadastros', label: 'Cadastros', icon: Database },
]

function PendingPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <section className="panel p-8">
        <p className="eyebrow">PRÓXIMA ETAPA</p>
        <h2 className="mt-3 text-xl font-semibold">
          Esta área está em preparação
        </h2>
        <p className="mt-2 max-w-xl text-slate-600">
          O primeiro fluxo disponível é o apontamento de produção. Esta página
          será implementada após a validação desse fluxo.
        </p>
        <NavLink className="button-primary mt-6 inline-flex" to="/producao">
          Ir para Produção
        </NavLink>
      </section>
    </>
  )
}

function Workspace() {
  const [menuOpen, setMenuOpen] = useState(false)
  const auth = useAuth()
  const access = useProjectAccess()
  if (!config.demo && !access.isSuccess)
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold">Acesso à obra</h1>
        <QueryFeedback
          pending={access.isPending}
          error={access.error}
          retry={() => void access.refetch()}
        />
        <button
          type="button"
          className="button-secondary"
          onClick={() => void auth.signOut()}
        >
          Sair da conta
        </button>
      </main>
    )
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <aside className="bg-slate-900 text-white lg:min-h-screen">
        <div className="flex items-center justify-between px-6 py-6 lg:py-9">
          <NavLink
            to="/producao"
            className="flex items-center gap-3"
            onClick={() => setMenuOpen(false)}
          >
            <Building2 aria-hidden="true" className="text-orange-400" />
            <span className="text-lg font-bold tracking-tight">
              CDP <span className="font-normal text-slate-300">CLARO</span>
            </span>
          </NavLink>
          <button
            type="button"
            className="p-3 lg:hidden"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        <nav
          id="main-navigation"
          aria-label="Principal"
          className={`${menuOpen ? 'block' : 'hidden'} px-4 pb-5 lg:block`}
        >
          <p className="px-3 pb-3 text-xs font-semibold tracking-widest text-slate-400">
            GESTÃO DA OBRA
          </p>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `my-1 flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium ${isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`
              }
            >
              <Icon size={19} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-5 sm:px-10">
          <div>
            <p className="eyebrow">OBRA ATUAL</p>
            <p className="mt-1 font-semibold">CDP BI02 · CLARO</p>
          </div>
          <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
            {config.demo ? 'Ambiente de demonstração' : 'Integração com API'}
          </span>
          {!config.demo && (
            <div className="flex items-center gap-3 text-sm">
              <span>{auth.session?.user.email}</span>
              <button
                className="min-h-11 underline"
                type="button"
                onClick={() => void auth.signOut()}
              >
                Sair
              </button>
            </div>
          )}
        </header>
        <main
          id="main"
          className="mx-auto max-w-6xl px-5 py-8 sm:px-10 sm:py-10"
        >
          {auth.error && (
            <p role="alert" className="mb-5 text-red-700">
              {auth.error}
            </p>
          )}
          {config.demo && (
            <p className="mb-7 border-l-2 border-orange-500 pl-3 text-sm text-slate-600">
              Dados fictícios para validar o fluxo. Os lançamentos ficam apenas
              nesta sessão e são reiniciados ao recarregar.
            </p>
          )}
          <Routes>
            <Route path="/" element={<Navigate to="/producao" replace />} />
            <Route path="/producao" element={<ProductionPage />} />
            <Route path="/historico" element={<HistoryPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/efetivo" element={<WorkforcePage />} />
            <Route path="/cadastros" element={<CatalogPage />} />
            <Route
              path="*"
              element={
                <PendingPage
                  title="Página não encontrada"
                  description="Verifique o endereço ou utilize o menu principal."
                />
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireSession>
            <Workspace />
          </RequireSession>
        }
      />
    </Routes>
  )
}
