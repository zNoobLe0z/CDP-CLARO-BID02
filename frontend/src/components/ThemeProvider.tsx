import { resolveTheme, type Preference } from '../lib/theme'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'

const storageKey = 'cdp.theme.v1'
function stored(): Preference {
  try {
    const value = localStorage.getItem(storageKey)
    if (value === 'light' || value === 'dark') return value
  } catch {
    /* Storage can be disabled by the browser. */
  }
  return 'system'
}
const ThemeContext = createContext<{
  preference: Preference
  setPreference: (value: Preference) => void
}>({ preference: 'system', setPreference: () => {} })
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Preference>(stored)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function apply() {
      const theme = resolveTheme(preference, media.matches)
      document.documentElement.dataset.theme = theme
      document.documentElement.style.colorScheme = theme
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preference])
  useEffect(() => {
    function changed(event: StorageEvent) {
      if (event.key === storageKey || event.key === null)
        setPreference(stored())
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [])
  function choose(value: Preference) {
    try {
      localStorage.setItem(storageKey, value)
    } catch {
      /* Apply the theme for this session regardless. */
    }
    setPreference(value)
  }
  return (
    <ThemeContext.Provider value={{ preference, setPreference: choose }}>
      {children}
    </ThemeContext.Provider>
  )
}
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useContext(ThemeContext)
  const Icon =
    preference === 'dark' ? Moon : preference === 'light' ? Sun : Monitor
  if (compact)
    return (
      <button
        type="button"
        className="icon-button"
        aria-label="Alterar tema"
        title={`Tema: ${preference === 'system' ? 'sistema' : preference === 'dark' ? 'escuro' : 'claro'}`}
        onClick={() =>
          setPreference(
            preference === 'light'
              ? 'dark'
              : preference === 'dark'
                ? 'system'
                : 'light',
          )
        }
      >
        <Icon size={18} aria-hidden="true" />
      </button>
    )
  return (
    <label className="theme-control">
      <Icon size={16} aria-hidden="true" />
      <span className="sr-only">Tema da interface</span>
      <select
        value={preference}
        onChange={(event) => setPreference(event.target.value as Preference)}
      >
        <option value="system">Tema do sistema</option>
        <option value="light">Tema claro</option>
        <option value="dark">Tema escuro</option>
      </select>
    </label>
  )
}
