import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'

export function Widget({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`panel dashboard-widget ${className}`}
      aria-label={title}
    >
      <div className="widget-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
export function Skeleton({
  kind = 'chart',
}: {
  kind?: 'chart' | 'rows' | 'kpis'
}) {
  return (
    <div
      role="status"
      aria-label="Carregando indicadores"
      className={`dashboard-skeleton skeleton-${kind}`}
    >
      <span className="sr-only">Carregando dados…</span>
      {kind === 'kpis' ? (
        Array.from({ length: 4 }, (_, index) => (
          <div key={index}>
            <i />
            <b />
            <i />
          </div>
        ))
      ) : kind === 'rows' ? (
        Array.from({ length: 5 }, (_, index) => (
          <div key={index}>
            <i />
            <i />
            <i />
          </div>
        ))
      ) : (
        <>
          <div>
            <i />
            <i />
          </div>
          <div className="skeleton-plot" />
          <div>
            <i />
            <i />
            <i />
          </div>
        </>
      )}
    </div>
  )
}
export function WidgetState<T>({
  query,
  kind = 'chart',
  children,
}: {
  query: UseQueryResult<T, Error>
  kind?: 'chart' | 'rows' | 'kpis'
  children: ReactNode
}) {
  if (query.isPending) return <Skeleton kind={kind} />
  if (query.isError && !query.data)
    return (
      <div className="widget-error" role="alert">
        <p>Não foi possível carregar este indicador.</p>
        <p className="mt-1 text-xs text-secondary">{query.error.message}</p>
        <button
          type="button"
          className="button-secondary mt-3"
          onClick={() => void query.refetch()}
        >
          Recarregar indicador
        </button>
      </div>
    )
  return (
    <>
      {query.isError && (
        <div className="widget-refresh-warning" role="alert">
          Exibindo a última consulta disponível.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => void query.refetch()}
          >
            Tentar atualizar
          </button>
        </div>
      )}
      {children}
    </>
  )
}
export function EmptyWidget({
  message,
  onReset,
}: {
  message: string
  onReset?: () => void
}) {
  return (
    <div className="widget-empty">
      <p>{message}</p>
      {onReset && (
        <button
          type="button"
          className="button-secondary mt-3"
          onClick={onReset}
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}
