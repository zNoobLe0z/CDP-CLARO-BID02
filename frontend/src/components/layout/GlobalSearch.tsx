import { useRef, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { ArrowUpRight, Search, X } from 'lucide-react'
import { productionService } from '../../features/production/service'
import { availableNavigation, normalizeSearch } from './navigation'

export function GlobalSearch({
  admin,
  onClose,
}: {
  admin: boolean
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => productionService.catalog(signal),
  })
  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])
  const needle = normalizeSearch(search)
  const pages = availableNavigation(admin).filter((item) =>
    normalizeSearch(`${item.label} ${item.description}`).includes(needle),
  )
  const results = needle
    ? (query.data ?? [])
        .filter((item) =>
          normalizeSearch(
            `${item.element_code} ${item.element_name} ${item.environment_name} ${item.activity_name} ${item.discipline_name}`,
          ).includes(needle),
        )
        .slice(0, 15)
    : []
  function go(path: string) {
    onClose()
    navigate(path)
  }
  return (
    <dialog
      ref={dialog}
      className="command-dialog"
      aria-labelledby="search-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="command-header">
        <Search size={18} aria-hidden="true" />
        <label className="sr-only" id="search-title" htmlFor="global-search">
          Buscar páginas e elementos da obra
        </label>
        <input
          id="global-search"
          type="search"
          placeholder="Buscar página, elemento ou atividade…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          className="icon-button"
          type="button"
          aria-label="Fechar busca"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="command-results">
        <p className="eyebrow mb-2">Páginas</p>
        {pages.map((item) => (
          <button
            className="command-result"
            type="button"
            key={item.to}
            onClick={() => go(item.to)}
          >
            <item.icon size={18} aria-hidden="true" />
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        ))}
        {needle && (
          <>
            <p className="eyebrow mb-2 mt-5">
              Escopo da obra · até 15 resultados
            </p>
            {query.isPending && <p role="status">Carregando escopo…</p>}
            {query.error && (
              <p role="alert" className="text-danger">
                {query.error.message}
              </p>
            )}
            {results.map((item) => (
              <button
                className="command-result"
                type="button"
                key={item.id}
                onClick={() =>
                  go(`/cadastros?item=${encodeURIComponent(item.id)}`)
                }
              >
                <span className="font-mono text-xs text-brand-ink">
                  {item.element_code}
                </span>
                <span>
                  <strong>{item.element_name}</strong>
                  <small>
                    {item.environment_name} · {item.activity_name}
                  </small>
                </span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            ))}
            {query.isSuccess && !results.length && (
              <p className="text-secondary">Nenhum elemento encontrado.</p>
            )}
          </>
        )}
        {!pages.length && (
          <p className="text-secondary">Nenhuma página encontrada.</p>
        )}
      </div>
      <footer className="command-footer">
        Tab para navegar · Enter para abrir · Esc para fechar
      </footer>
    </dialog>
  )
}
