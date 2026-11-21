import { Link } from 'react-router'
import type { ProductionRecord } from '../../production/history-types'
import { relativeTime } from '../analytics'
import { dateLabel, number, units } from '../../../lib/format'
export function ActivityFeed({ items }: { items: ProductionRecord[] }) {
  return (
    <ol className="activity-feed">
      {items.slice(0, 5).map((row) => (
        <li key={row.id}>
          <div className="flex items-center justify-between gap-2">
            <span
              className={`status-badge ${row.status === 'corrected' ? 'text-warning' : 'text-secondary'}`}
            >
              {row.status === 'corrected' ? 'Correção' : 'Medição'}
            </span>
            <time
              dateTime={row.created_at}
              title={new Date(row.created_at).toLocaleString('pt-BR')}
            >
              {relativeTime(row.created_at)}
            </time>
          </div>
          <Link
            to={`/historico?registro=${encodeURIComponent(row.id)}`}
            className="mt-2 flex min-h-10 items-center text-sm font-medium text-brand-ink hover:underline"
          >
            {row.activity_name} · {row.element_code}
          </Link>
          <p className="mt-1 text-xs text-secondary">
            {number(row.quantity)} {units[row.unit]} · {row.environment_name}
          </p>
          <p className="mt-2 text-[11px] text-secondary">
            {row.author_name} · execução {dateLabel(row.execution_date)}
          </p>
        </li>
      ))}
    </ol>
  )
}
