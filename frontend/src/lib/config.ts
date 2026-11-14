const source = import.meta.env.VITE_DATA_SOURCE ?? 'demo'
if (source !== 'demo' && source !== 'api')
  throw new Error('VITE_DATA_SOURCE deve ser demo ou api.')
export const config = {
  demo: source === 'demo',
  apiBaseUrl: (
    import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'
  ).replace(/\/$/, ''),
  projectId: import.meta.env.VITE_PROJECT_ID ?? 'claro-bi02',
}
