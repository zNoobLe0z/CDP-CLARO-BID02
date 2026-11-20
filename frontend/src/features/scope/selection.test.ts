import { expect, it } from 'vitest'
import { emptySelection, selectScope } from './selection'

const selected = {
  floor: 'floor-2',
  environment: 'meeting-1',
  discipline: 'finishes',
  activity: 'painting',
  element: 'wall-east',
}
it('mudar o andar limpa todos os níveis dependentes', () => {
  expect(selectScope(selected, 'floor', 'floor-3')).toEqual({
    ...emptySelection,
    floor: 'floor-3',
  })
})
it('mudar atividade mantém ancestrais e limpa elemento', () => {
  expect(selectScope(selected, 'activity', 'doors')).toEqual({
    ...selected,
    activity: 'doors',
    element: '',
  })
  expect(selectScope(selected, 'environment', '')).toEqual({
    ...emptySelection,
    floor: 'floor-2',
  })
})
it('não permite saltar um nível ou limpar descendentes sem mudança real', () => {
  expect(selectScope(emptySelection, 'activity', 'painting')).toBe(
    emptySelection,
  )
  expect(selectScope(selected, 'floor', 'floor-2')).toBe(selected)
})
