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
- Login implementado com Supabase Auth. No modo API, configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; contas devem ser previamente liberadas. A API também deve responder a `/projects/{id}/me` com o perfil da obra. Sem configuração ou sessão, os dados reais ficam bloqueados.
- Toda variável `VITE_*` é pública. Nunca colocar segredos administrativos nela.
- Produção tem cascata, medição percentual adicional, checklist, prévia de quantidade, gravação em lote e confirmação de descarte. Histórico tem filtros, paginação e correções justificadas preservando originais. Dashboard mostra avanço ponderado e produção diária por unidade. Efetivo registra contagens por dia e empresa com revisões. Cadastros permite consultar o escopo e seus pesos, sem edição administrativa nesta etapa.
- O backend é a autoridade para saldo, arredondamento, autorização, autoria e indicadores. A prévia local é apenas informativa.
- Não há suporte offline. Demonstração usa dados compartilhados entre as telas, em memória, reiniciados ao recarregar. A API Python em `backend/` implementa os endpoints e foi verificada com o frontend e PostgreSQL locais. Para uso real, ainda é necessário configurar o ambiente e homologar o projeto de autenticação e os dados da obra.
- Em hospedagem estática, configurar fallback de rotas para `index.html`.

## Organização

```text
src/components/             Componentes compartilhados
src/features/production/    Tela, tipos, regras de prévia e adaptadores
src/lib/                   Ambiente e cliente HTTP
src/test/                  Preparação dos testes
```

Contratos propostos: [Produção](../docs/api-production.md), [histórico](../docs/api-history.md), [dashboard e efetivo](../docs/api-dashboard-workforce.md). [Autenticação](../docs/authentication.md). Tarefas: [backlog](../docs/frontend-tasks.md).

## Interface técnica e temas

A aplicação utiliza tokens semânticos Light/Dark com Azul Petróleo, fontes locais Inter e JetBrains Mono e controles de tema persistidos. O shell inclui sidebar retrátil, drawer mobile, busca com Ctrl/Cmd+K e avisos do ambiente. Consulte [a documentação do redesign](../docs/technical-ui.md) para arquitetura, componentes e verificação.
