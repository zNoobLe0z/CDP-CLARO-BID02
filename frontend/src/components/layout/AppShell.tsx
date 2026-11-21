import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Search,
  Bell,
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  UserRound,
  Plus,
} from 'lucide-react'
import { useAuth } from '../../features/auth/context'
import { useProjectAccess } from '../../features/auth/access'
import { config } from '../../lib/config'
import { ThemeToggle } from '../ThemeProvider'
import { availableNavigation } from './navigation'
import { GlobalSearch } from './GlobalSearch'

function EnvironmentNotices({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cache = useQueryClient().getQueryCache()
  const errors = cache
    .getAll()
    .filter((query) => query.state.status === 'error')
  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])
  return (
    <dialog
      ref={dialog}
      className="notice-dialog"
      aria-labelledby="notices-title"
      onClose={onClose}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 id="notices-title" className="font-semibold">
          Avisos do ambiente
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar avisos"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-4 p-5">
        {config.demo && (
          <div>
            <span className="status-badge text-warning">Demonstração</span>
            <p className="mt-2 text-secondary">
              Dados fictícios. Os lançamentos desta sessão são reiniciados ao
              recarregar a página.
            </p>
          </div>
        )}
        {errors.length ? (
          errors.map((query) => (
            <p key={query.queryHash} className="text-danger">
              {query.state.error?.message ?? 'Falha ao consultar dados.'}
            </p>
          ))
        ) : (
          <p className="text-secondary">
            Nenhum erro de consulta registrado nesta sessão.
          </p>
        )}
        <p className="text-xs text-secondary">
          Avisos locais de operação. Alertas de cronograma e qualidade ainda não
          estão disponíveis.
        </p>
      </div>
    </dialog>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const access = useProjectAccess()
  const admin = access.data?.role === 'admin'
  const links = availableNavigation(admin)
  const pathname = useLocation().pathname
  const current = links.find((item) => item.to === pathname)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('cdp.sidebar.v1') === 'collapsed'
    } catch {
      return false
    }
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [noticesOpen, setNoticesOpen] = useState(false)
  const drawer = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    function closeWide() {
      if (media.matches) drawer.current?.close()
    }
    media.addEventListener('change', closeWide)
    return () => media.removeEventListener('change', closeWide)
  }, [])
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k' &&
        !document.querySelector('dialog[open]')
      ) {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  function collapse() {
    setCollapsed((value) => {
      try {
        localStorage.setItem('cdp.sidebar.v1', value ? 'expanded' : 'collapsed')
      } catch {
        /* Session state remains available. */
      }
      return !value
    })
  }
  function closeDrawer() {
    drawer.current?.close()
    setDrawerOpen(false)
  }
  function sidebar(compact: boolean) {
    return (
      <>
        <div className="shell-logo">
          <NavLink
            to="/dashboard"
            className="flex min-w-0 items-center gap-2.5"
            aria-label="CDP CLARO — Dashboard"
            onClick={closeDrawer}
          >
            <span className="brand-mark">
              <Building2 size={20} aria-hidden="true" />
            </span>
            {!compact && (
              <span className="font-semibold tracking-tight">
                CDP <span className="font-normal text-secondary">CLARO</span>
              </span>
            )}
          </NavLink>
          {!compact && (
            <button
              type="button"
              className="icon-button drawer-close"
              aria-label="Fechar menu"
              onClick={closeDrawer}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <details className="project-switch">
          <summary title="Obra ativa: CDP BI02 · CLARO">
            <Building2 size={17} aria-hidden="true" />
            {!compact && (
              <>
                <span>
                  <small>OBRA ATIVA</small>
                  <strong>CDP BI02 · CLARO</strong>
                </span>
                <ChevronsUpDown size={14} aria-hidden="true" />
              </>
            )}
          </summary>
          <div className="project-options">
            <p className="eyebrow">Obra disponível</p>
            <p className="mt-2 font-medium">CDP BI02 · CLARO</p>
            <p className="mt-1 text-xs text-secondary">
              {config.projectId} · ambiente atual
            </p>
          </div>
        </details>
        <nav className="shell-navigation" aria-label="Principal">
          {['Visão geral', 'Operação de campo', 'Estrutura da obra'].map(
            (group) => (
              <div className="nav-group" key={group}>
                {!compact && <p className="eyebrow nav-group-label">{group}</p>}
                {links
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeDrawer}
                      className={({ isActive }) =>
                        `nav-item ${isActive ? 'is-active' : ''}`
                      }
                      title={compact ? item.label : undefined}
                      aria-label={compact ? item.label : undefined}
                    >
                      <item.icon size={18} aria-hidden="true" />
                      {!compact && <span>{item.label}</span>}
                    </NavLink>
                  ))}
              </div>
            ),
          )}
        </nav>
        <footer className="sidebar-footer">
          <ThemeToggle compact={compact} />
          <div className={`profile-row ${compact ? 'justify-center' : ''}`}>
            <span className="profile-avatar" title={access.data?.display_name}>
              <UserRound size={16} aria-hidden="true" />
            </span>
            {!compact && (
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs font-medium">
                  {access.data?.display_name ??
                    auth.session?.user.email ??
                    'Engenharia'}
                </strong>
                <small className="text-xs text-secondary">
                  {admin
                    ? 'Administrador'
                    : access.data?.role === 'editor'
                      ? 'Engenharia'
                      : 'Consulta'}
                </small>
              </span>
            )}
            {!compact && !config.demo && (
              <button
                type="button"
                className="icon-button"
                aria-label="Sair da conta"
                title="Sair da conta"
                onClick={() => void auth.signOut()}
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </footer>
      </>
    )
  }
  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <a href="#main" className="skip-link">
        Pular para o conteúdo
      </a>
      <aside className="desktop-sidebar">{sidebar(collapsed)}</aside>
      <dialog
        ref={drawer}
        className="mobile-drawer"
        aria-label="Menu da obra"
        onClose={() => setDrawerOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer()
        }}
      >
        <div className="drawer-content">{sidebar(false)}</div>
      </dialog>
      <div className="workspace">
        <header className="topbar">
          <button
            type="button"
            className="icon-button mobile-menu"
            aria-label="Abrir menu"
            aria-expanded={drawerOpen}
            onClick={() => {
              drawer.current?.showModal()
              setDrawerOpen(true)
            }}
          >
            <Menu size={19} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button desktop-collapse"
            aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'}
            aria-expanded={!collapsed}
            onClick={collapse}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={18} aria-hidden="true" />
            )}
          </button>
          <nav className="breadcrumbs" aria-label="Localização">
            <NavLink to="/dashboard">Obras</NavLink>
            <ChevronRight size={12} aria-hidden="true" />
            <span className="breadcrumb-project">CDP BI02</span>
            <ChevronRight size={12} aria-hidden="true" />
            <span aria-current="page">{current?.label ?? 'Página'}</span>
          </nav>
          <div className="topbar-actions">
            <button
              type="button"
              className="global-search-trigger"
              aria-label="Buscar na obra"
              aria-keyshortcuts="Control+k Meta+k"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} aria-hidden="true" />
              <span>Buscar na obra</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Avisos do ambiente"
              onClick={() => setNoticesOpen(true)}
            >
              <Bell size={18} aria-hidden="true" />
            </button>
            {pathname !== '/producao' && access.data?.role !== 'viewer' && (
              <NavLink to="/producao" className="button-primary topbar-primary">
                <Plus size={16} aria-hidden="true" />
                Apontar produção
              </NavLink>
            )}
          </div>
        </header>
        <main id="main" className="workspace-content">
          {config.demo && (
            <div className="environment-strip">
              <span className="status-badge text-warning">Demonstração</span>
              <p>Dados fictícios · alterações válidas somente nesta sessão</p>
              <span className="ml-auto hidden font-mono text-[11px] sm:block">
                {config.projectId.toUpperCase()}
              </span>
            </div>
          )}
          {auth.error && (
            <p role="alert" className="mb-4 text-danger">
              {auth.error}
            </p>
          )}
          {children}
        </main>
      </div>
      {searchOpen && (
        <GlobalSearch admin={admin} onClose={() => setSearchOpen(false)} />
      )}
      {noticesOpen && (
        <EnvironmentNotices onClose={() => setNoticesOpen(false)} />
      )}
    </div>
  )
}
