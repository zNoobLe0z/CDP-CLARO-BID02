import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ThemeProvider, ThemeToggle } from './ThemeProvider'

let dark = false
let changed: () => void = () => {}
beforeEach(() => {
  localStorage.clear()
  dark = false
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return dark
    },
    addEventListener: (_event: string, callback: () => void) => {
      changed = callback
    },
    removeEventListener: vi.fn(),
  }))
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('acompanha o sistema, respeita a escolha explícita e persiste a preferência', async () => {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
  expect(document.documentElement.dataset.theme).toBe('light')
  act(() => {
    dark = true
    changed()
  })
  expect(document.documentElement.dataset.theme).toBe('dark')
  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: 'Tema da interface' }),
    'light',
  )
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(localStorage.getItem('cdp.theme.v1')).toBe('light')
  act(() => {
    changed()
  })
  expect(document.documentElement.dataset.theme).toBe('light')
})
it('sincroniza a preferência quando outra aba altera o tema', () => {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
  act(() => {
    localStorage.setItem('cdp.theme.v1', 'dark')
    window.dispatchEvent(new StorageEvent('storage', { key: 'cdp.theme.v1' }))
  })
  expect(document.documentElement.dataset.theme).toBe('dark')
})
it('permite trocar o tema quando o armazenamento está indisponível', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage disabled')
  })
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: 'Tema da interface' }),
    'dark',
  )
  expect(document.documentElement.dataset.theme).toBe('dark')
})
