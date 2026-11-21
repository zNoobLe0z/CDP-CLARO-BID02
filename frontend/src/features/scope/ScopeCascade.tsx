import { SelectField } from '../../components/SelectField'
import {
  emptySelection,
  levels,
  selectScope,
  type ScopeSelection,
} from './selection'
import type { useScopeCascade } from './useScopeCascade'

const labels = [
  'Andar',
  'Ambiente',
  'Disciplina',
  'Atividade',
  'Elemento físico',
]
const emptyMessages = [
  'Nenhum andar cadastrado.',
  'Nenhum ambiente cadastrado neste andar.',
  'Nenhuma disciplina cadastrada neste ambiente.',
  'Nenhuma atividade cadastrada nesta disciplina.',
  'Nenhum elemento cadastrado para esta atividade.',
]

export function ScopeCascade({
  selection,
  onChange,
  cascade,
  required = false,
  prefix,
  disabled = false,
}: {
  selection: ScopeSelection
  onChange: (next: ScopeSelection) => void
  cascade: ReturnType<typeof useScopeCascade>
  required?: boolean
  prefix: string
  disabled?: boolean
}) {
  const path = levels
    .map(
      (level, index) =>
        cascade.options[index].find((option) => option.id === selection[level])
          ?.name,
    )
    .filter(Boolean)
  return (
    <div>
      <p className="mb-4 text-xs text-secondary">
        Selecione em sequência: Andar → Ambiente → Disciplina → Atividade →
        Elemento físico.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {levels.map((level, index) => (
          <SelectField
            key={level}
            id={`${prefix}-${level}`}
            label={labels[index]}
            value={selection[level]}
            options={cascade.options[index]}
            loading={
              cascade.enabled[index] && cascade.queries[index].isFetching
            }
            disabled={
              disabled ||
              cascade.queries[index].isError ||
              !cascade.enabled[index] ||
              (index > 0 && cascade.queries[index - 1].isFetching)
            }
            emptyLabel={
              index === 4
                ? 'Todos os elementos da atividade'
                : required
                  ? 'Selecione'
                  : 'Todos neste contexto'
            }
            onChange={(value) => {
              if (
                value &&
                !cascade.options[index].some((option) => option.id === value)
              )
                return
              onChange(selectScope(selection, level, value))
            }}
          />
        ))}
      </div>
      {levels.map((level, index) =>
        cascade.enabled[index] &&
        cascade.queries[index].isSuccess &&
        !cascade.queries[index].isFetching &&
        !cascade.options[index].length ? (
          <p key={level} role="status" className="mt-4 text-sm text-secondary">
            {emptyMessages[index]}
          </p>
        ) : null,
      )}
      {path.length > 0 && (
        <nav aria-label="Caminho selecionado" className="mt-4">
          <ol className="flex flex-wrap gap-2 text-xs text-secondary">
            {path.map((name, index) => (
              <li
                key={`${index}:${name}`}
                className="rounded bg-subtle px-2 py-1"
              >
                {index + 1}. {name}
              </li>
            ))}
          </ol>
        </nav>
      )}
      {cascade.error && (
        <div role="alert" className="mt-4 text-sm text-danger">
          <p>{cascade.error.error?.message}</p>
          <button
            type="button"
            className="min-h-10 underline"
            onClick={() => void cascade.error?.refetch()}
          >
            Tentar carregar opções novamente
          </button>
        </div>
      )}
      {cascade.stale && (
        <p role="alert" className="mt-4 text-sm text-danger">
          Uma seleção não pertence mais ao contexto disponível. Limpe a seleção
          e escolha novamente.
        </p>
      )}
      {levels.some((level) => Boolean(selection[level])) && (
        <button
          type="button"
          className="mt-3 min-h-10 text-sm font-semibold underline"
          disabled={disabled}
          onClick={() => onChange({ ...emptySelection })}
        >
          Limpar seleção
        </button>
      )}
    </div>
  )
}
