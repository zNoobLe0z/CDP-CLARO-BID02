export type Preference = 'light' | 'dark' | 'system'
export function resolveTheme(preference: Preference, dark: boolean) {
  return preference === 'system' ? (dark ? 'dark' : 'light') : preference
}
