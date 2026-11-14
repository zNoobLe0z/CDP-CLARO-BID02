# Frontend CDP CLARO

Base em React, TypeScript estrito, Vite, Tailwind CSS, React Router e TanStack Query. Ícones Lucide. Lint com Oxlint, formatação com Prettier e testes com Vitest e Testing Library.

## Executar

Requer Node.js 24 e npm 11.

```sh
cd frontend
npm ci
npm run dev
```

Abra o endereço informado pelo Vite. Opcionalmente copie `.env.example` para `.env.local`.

## Verificações

```sh
npm run check
npm run test:watch
npm run format
```

`check` executa lint, conferência de formatação, testes e build com checagem de tipos. A mesma sequência roda no GitHub Actions. O lockfile é versionado; use `npm ci` nas instalações reproduzíveis.

## Modos e limites

- `VITE_DATA_SOURCE=demo` é o padrão. Dados fictícios, salvos apenas em memória até recarregar. Não há usuário autenticado, banco ou indicadores oficiais neste modo.
- `VITE_DATA_SOURCE=api` usa `VITE_API_BASE_URL` e `VITE_PROJECT_ID`. Não há fallback automático para dados fictícios em caso de falha.
- Login ainda não implementado: antes de usar a API, conectar `configureAccessToken` à sessão atual do provedor de autenticação. Sem token, o cliente bloqueia a chamada com erro explícito.
- Toda variável `VITE_*` é pública. Nunca colocar segredos administrativos nela.
- Produção tem cascata, medição percentual adicional, checklist, prévia de quantidade e gravação em lote. Dashboard, Efetivo e Cadastros têm somente rotas e estados de preparação.
- O backend é a autoridade para saldo, arredondamento, autorização, autoria e indicadores. A prévia local é apenas informativa.
- Não há suporte offline, histórico ou correção nesta entrega. Navegar para outra página descarta formulários não enviados.
- Em hospedagem estática, configurar fallback de rotas para `index.html`.

## Organização

```text
src/components/             Componentes compartilhados
src/features/production/    Tela, tipos, regras de prévia e adaptadores
src/lib/                   Ambiente e cliente HTTP
src/test/                  Preparação dos testes
```

Contrato proposto: [Produção](../docs/api-production.md). Tarefas: [backlog](../docs/frontend-tasks.md).
