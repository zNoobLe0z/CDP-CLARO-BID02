import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowDownUp } from 'lucide-react'
import type { WorkStage } from '../types'
import { stageLink } from '../analytics'
import { dateLabel, number } from '../../../lib/format'
export function WorkStagesTable({ items }: { items: WorkStage[] }) {
  const [sort, setSort] = useState<'name' | 'progress'>('name')
  const [descending, setDescending] = useState(false)
  const [page, setPage] = useState(1)
  function order(key: 'name' | 'progress') {
    setDescending(sort === key ? !descending : false)
    setSort(key)
    setPage(1)
  }
  const rows = [...items].sort(
    (a, b) =>
      (sort === 'progress'
        ? Number(a.percentage) - Number(b.percentage)
        : `${a.activity_name} ${a.environment_name}`.localeCompare(
            `${b.activity_name} ${b.environment_name}`,
            'pt-BR',
          )) * (descending ? -1 : 1),
  )
  const pages = Math.max(1, Math.ceil(rows.length / 8)),
    current = Math.min(page, pages)
  return (
    <>
      <div
        className="table-scroll work-stages-grid"
        role="region"
        aria-label="Frentes de serviço"
        tabIndex={0}
      >
        <table className="data-grid">
          <caption className="sr-only">
            Avanço acumulado por ambiente e atividade
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                aria-sort={
                  sort === 'name'
                    ? descending
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                }
              >
                <button type="button" onClick={() => order('name')}>
                  Frente de serviço <ArrowDownUp size={12} aria-hidden="true" />
                </button>
              </th>
              <th scope="col">Situação</th>
              <th
                scope="col"
                className="numeric"
                aria-sort={
                  sort === 'progress'
                    ? descending
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                }
              >
                <button type="button" onClick={() => order('progress')}>
                  Avanço <ArrowDownUp size={12} aria-hidden="true" />
                </button>
              </th>
              <th scope="col" className="numeric">
                Itens
              </th>
              <th scope="col">Última execução</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice((current - 1) * 8, current * 8).map((row) => (
              <tr key={JSON.stringify([row.environment_id, row.activity_id])}>
                <td>
                  <Link
                    to={stageLink(row)}
                    className="flex min-h-10 items-center font-medium text-brand-ink hover:underline"
                    title={row.activity_name}
                  >
                    {row.activity_name}
                  </Link>
                  <span className="mt-1 block text-[11px] text-secondary">
                    {row.floor_name} · {row.environment_name}
                  </span>
                </td>
                <td>
                  <span
                    className={`status-badge ${row.status === 'completed' ? 'text-success' : row.status === 'in_progress' ? 'text-info' : 'text-secondary'}`}
                  >
                    {row.status === 'completed'
                      ? 'Concluída'
                      : row.status === 'in_progress'
                        ? 'Em execução'
                        : 'A iniciar'}
                  </span>
                </td>
                <td className="numeric">
                  <span>{number(row.percentage)}%</span>
                  <progress
                    value={Number(row.percentage)}
                    max={100}
                    aria-label={`Avanço de ${row.activity_name} em ${row.environment_name}`}
                    className="mt-2 min-w-20"
                  />
                </td>
                <td className="numeric">
                  {row.completed_items} / {row.total_items}
                </td>
                <td className="font-mono text-xs">
                  {row.last_execution_date
                    ? dateLabel(row.last_execution_date)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="widget-table-footer">
        <p>{items.length} frentes · acumulado até a referência</p>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="button-secondary"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Anterior
            </button>
            <span>
              {current} / {pages}
            </span>
            <button
              type="button"
              className="button-secondary"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </>
  )
}
