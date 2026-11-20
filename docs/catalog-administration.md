# Administração do catálogo

A rota `/administracao` permite aos administradores criar e editar andares, ambientes, disciplinas, atividades, elementos físicos, itens de escopo e empresas. Exige modo API e perfil `admin` da obra. No modo de demonstração a edição fica indisponível, com orientação explícita; os cadastros fictícios continuam consultáveis.

## Regras

- Identificador permanente e único por obra/tipo. Cadastro completo exige justificativa com ao menos cinco caracteres.
- Vínculos só podem apontar para cadastros existentes na mesma obra. Cada combinação elemento/atividade possui um único escopo.
- Quantidade prevista e peso positivos, decimais em texto com ponto e até seis casas. Item unitário exige `un` e quantidade 1.
- Alterações enviam `expected_version`; conflito exige carregar os dados atuais. Reenvio do mesmo conteúdo usa a mesma chave de idempotência após falha de conexão.
- Após qualquer apontamento ou saldo executado, quantidades, pesos e vínculos estruturais ficam congelados, inclusive andar do ambiente e disciplina da atividade. Nomes e códigos podem ser corrigidos com auditoria.
- Histórico registra autor autenticado, data, justificativa e valores antes/depois na mesma transação. A tela mostra as últimas 20 alterações do tipo ou item selecionado; a API permite paginação.
- Exclusão e revisão de escopo já utilizado não fazem parte desta entrega.

## API

Prefixo `/api/v1/projects/{project_id}/admin`:

- `GET /catalog/{kind}`: lista os cadastros administrativos.
- `POST /catalog/{kind}`: cria cadastro; exige `Idempotency-Key` UUID.
- `PUT /catalog/{kind}/{entity_id}`: atualiza cadastro com versão esperada e chave de idempotência.
- `GET /audit?entity_type=...&entity_id=...&page=1`: histórico em páginas de 20.

Tipos: `floors`, `environments`, `disciplines`, `activities`, `elements`, `scope-items`, `companies`. Contratos completos no OpenAPI da API. A seleção em cascata de produção passa a utilizar os cadastros quando existir escopo relacionando local e serviço.

## Instalação

Aplicar `uv run alembic upgrade head` com a conta de migração e reaplicar `backend/sql/runtime_role.sql` com a conta administrativa. A revisão `6c1b8e185d8b` adiciona versões e auditoria; não modifica os apontamentos existentes. Não executar a API com a conta administrativa.

## Validação desta entrega

- PostgreSQL 17 local: 33 testes, incluindo carga de toda a hierarquia seguida de produção de 2,5 m², autorização, auditoria, idempotência, conflitos e bloqueio do escopo usado.
- O teste de usuário PostgreSQL restrito também cria cadastro pela API e continua impedindo alteração direta da quantidade original dos apontamentos.
- Frontend: 29 testes, lint, formatação e build aprovados; teste específico mantém campos e chave de idempotência após falha de conexão.
- Navegador Edge: criação, recarregamento, edição com versão 2 e auditoria confirmados contra FastAPI e PostgreSQL locais. Inspeção visual em 390 px sem rolagem horizontal.
- Autenticação externa simulada com identidade fictícia somente no teste integrado local. Supabase remoto não foi configurado nem alterado.

## Próximas etapas

Importação CSV com prévia e transação única; filtros e paginação para catálogos grandes; homologação com Supabase real; publicação com HTTPS e backups. Produção individual por funcionário, cronograma planejado e controle de qualidade continuam fora desta entrega.
