import { NavLink, Navigate, Route, Routes } from 'react-router'
import { AppShell } from './components/layout/AppShell'
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
import { CatalogAdminPage } from './features/catalog/CatalogAdminPage'
import { CatalogPage } from './features/catalog/CatalogPage'

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
        <p className="mt-2 max-w-xl text-secondary">
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
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/producao" replace />} />
        <Route path="/producao" element={<ProductionPage />} />
        <Route path="/historico" element={<HistoryPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/efetivo" element={<WorkforcePage />} />
        <Route path="/administracao" element={<CatalogAdminPage />} />
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
    </AppShell>
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
