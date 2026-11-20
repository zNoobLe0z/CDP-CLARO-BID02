import { config } from './config'

export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string>
  constructor(
    message: string,
    status: number,
    code: string,
    fields: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

let getAccessToken: () => Promise<string | null> = async () => null
// A integração de autenticação fornecerá a sessão atual sem persistir tokens neste módulo.
export function configureAccessToken(provider: typeof getAccessToken) {
  getAccessToken = provider
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken()
  if (!token)
    throw new ApiError(
      'Sua sessão expirou. Entre novamente para acessar a obra.',
      401,
      'AUTH_REQUIRED',
    )
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, { ...init, headers })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error
    throw new ApiError(
      'Não foi possível conectar. Confira sua conexão e tente novamente.',
      0,
      'NETWORK_ERROR',
    )
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(
      body?.error?.message ?? 'Não foi possível concluir a solicitação.',
      response.status,
      body?.error?.code ?? 'REQUEST_FAILED',
      Object.fromEntries(
        Object.entries(body?.error?.fields ?? {}).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      ),
    )
  }
  return response.json() as Promise<T>
}
