import type { ProgressGroup } from '../types'
import { number } from '../../../lib/format'
export function DisciplineChart({ groups }: { groups: ProgressGroup[] }) {
  return (
    <div className="discipline-bars">
      {[...groups]
        .sort(
          (a, b) =>
            Number(b.percentage) - Number(a.percentage) ||
            a.name.localeCompare(b.name, 'pt-BR'),
        )
        .map((row) => (
          <div key={row.id}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <span
                className="min-w-0 truncate text-xs font-medium"
                title={row.name}
              >
                {row.name}
              </span>
              <strong className="font-mono text-xs font-medium">
                {number(row.percentage)}%
              </strong>
            </div>
            <progress
              value={Number(row.percentage)}
              max={100}
              aria-label={`Avanço de ${row.name}`}
            />
            <p className="mt-2 text-[11px] text-secondary">
              {row.completed_items} / {row.total_items} elementos concluídos
            </p>
          </div>
        ))}
    </div>
  )
}
