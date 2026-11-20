export const units = { m2: 'm²', m: 'm', un: 'un' }
export const number = (value: number | string) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(
    Number(value),
  )
export const dateLabel = (value: string) => value.split('-').reverse().join('/')
