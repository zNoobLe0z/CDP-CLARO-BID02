import type { Option } from '../features/production/types'

interface Props {
  id: string
  label: string
  value: string
  options: Option[]
  disabled?: boolean
  loading?: boolean
  onChange: (value: string) => void
}
export function SelectField({
  id,
  label,
  value,
  options,
  disabled,
  loading,
  onChange,
}: Props) {
  return (
    <label className="grid gap-2 text-sm font-semibold" htmlFor={id}>
      {label}
      <select
        id={id}
        value={value}
        disabled={disabled || loading}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{loading ? 'Carregando…' : 'Selecione'}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  )
}
