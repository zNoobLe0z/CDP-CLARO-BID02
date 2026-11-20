# API CDP CLARO

API Python com FastAPI, SQLAlchemy, psycopg e PostgreSQL. Implementa os contratos consumidos pelo frontend: acesso à obra, seleção em cascata, consulta de escopo, produção em lote, histórico paginado, correções rastreáveis, dashboard e efetivo com revisões.

## Preparação

Requer Python 3.12 a 3.14, uv e PostgreSQL. O banco foi verificado em PostgreSQL 17. As dependências estão travadas em `uv.lock`.

```powershell
cd backend
uv sync --frozen
Copy-Item .env.example .env
```

Preencha `.env` localmente, sem versioná-lo:

| Variável | Uso |
| --- | --- |
| DATABASE_URL | Conexão PostgreSQL exclusiva do backend, com usuário restrito |
| MIGRATION_DATABASE_URL | Conexão administrativa separada para migrações |
| SUPABASE_URL | URL do projeto de autenticação |
| SUPABASE_PUBLISHABLE_KEY | Chave publicável do mesmo projeto; não exige service_role |
| CORS_ORIGINS | Lista JSON com as origens exatas do frontend |

Conexões `postgresql+psycopg://`, `postgresql://` e `postgres://` são aceitas. Preserve as opções de SSL fornecidas pelo Supabase. Escolha a conexão direta ou pooler conforme a rede e o ambiente; prepared statements automáticos estão desativados para compatibilidade com pooler transacional. Não colocar credenciais de banco em variáveis `VITE_*`.

## Migração e usuário restrito

```powershell
uv run alembic upgrade head
uv run alembic current
```

As migrações usam MIGRATION_DATABASE_URL, ou DATABASE_URL se a conexão administrativa não estiver definida. Não são executadas ao iniciar a API. O schema `cdp` é privado, sem acesso de PUBLIC; mantenha-o fora dos schemas expostos pela Data API do Supabase.

Com uma conexão administrativa, execute `sql/runtime_role.sql` para criar o grupo `cdp_api`. O administrador do banco deve criar um login próprio com senha forte e associá-lo a esse grupo, configurando-o em DATABASE_URL. O grupo permite somente as leituras e colunas de gravação necessárias à API: não permite alterar associações de usuários, quantidades originais dos apontamentos, pesos, cadastros ou apagar registros. Uma conexão administrativa continua necessária para manutenção/importação do escopo.

A autorização de usuários finais é feita na API pela tabela `cdp.memberships`. Papéis: admin/editor podem apontar, corrigir e registrar efetivo; viewer somente consulta. Não usar user_metadata do Supabase para decidir permissões. A credencial do banco é do servidor, não do engenheiro.

## Executar

```powershell
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Documentação e formulários da API: `http://127.0.0.1:8000/docs`.
- Especificação OpenAPI: `/openapi.json`.
- `/health/live` indica processo ativo. `/health/ready` verifica configuração e acesso ao schema migrado.
- Backend valida cada token pelo endpoint `/auth/v1/user` do Supabase. Uma falha na autenticação externa não concede acesso. Não há modo de autenticação falsa na aplicação publicada.
- Para o frontend real: configurar VITE_DATA_SOURCE=api, VITE_API_BASE_URL apontando para `/api/v1`, VITE_PROJECT_ID, VITE_SUPABASE_URL e a chave publicável. Projeto e usuário devem ter associação em memberships.

## Carga fictícia explícita

Para um banco local descartável, com conexão administrativa em DATABASE_URL:

```powershell
uv run python -m app.bootstrap --user-id ID_DO_USUARIO --confirm-demo
```

Cria a obra fictícia claro-bi02 e o escopo de exemplo, incluindo medições iniciais rastreáveis. Recusa alterar uma obra existente. O comando não cria nem modifica uma conta Supabase; use um ID de usuário liberado para homologação. Não executar em produção nem utilizar como importador de escopo real.

## Garantias das gravações

- Quantidades calculadas com Decimal e armazenadas em numeric(18,6), arredondamento half-up a seis casas. Incrementos que arredondam para zero são recusados.
- Transação é concluída antes de enviar a resposta HTTP de sucesso.
- Lotes limitados a 200 itens distintos da mesma atividade/ambiente.
- Itens bloqueados em ordem estável e versões conferidas após o bloqueio. Saldo nunca pode ultrapassar previsto.
- Idempotency-Key UUID obrigatório nas gravações. Registro persistido na mesma transação, isolado por obra, usuário e operação. Replay é verificado antes da versão e retorna a resposta original. Falha desfaz inclusive a reserva da chave.
- Chaves são retidas sem expiração nesta etapa; uma política de retenção/limpeza precisa ser acordada antes da operação de longo prazo.
- Correções preservam quantidade, autor e data do original; criam substituto com justificativa e ajustam saldo atomicamente.
- Criação/atualização de efetivo usa lock por obra/data/empresa, unicidade e versão. Zero é um registro válido; ausência de linha significa não informado.
- Consultas GET usam snapshot consistente por transação. O dashboard agrega registros válidos por data de execução e separa unidades.

## Verificações

Use um banco de teste separado, cujo nome termine em `_test`. A fixture limpa somente as tabelas do schema cdp desse banco.

```powershell
$env:TEST_DATABASE_URL = 'CONEXAO_ADMINISTRATIVA_DO_BANCO_DE_TESTE'
$env:MIGRATION_DATABASE_URL = $env:TEST_DATABASE_URL
uv run alembic upgrade head
uv run ruff check app tests migrations
uv run ruff format --check app tests migrations
uv run pytest -q
```

Sem TEST_DATABASE_URL, os testes de PostgreSQL são marcados como ignorados; os testes de validação/autenticação ainda rodam. O GitHub Actions sempre configura PostgreSQL e executa todos os testes, em Python 3.12 e 3.14. O teste de privilégios cria um login fictício somente no ambiente de teste; a conexão de teste deve permitir criar papéis.

## Pendências antes do piloto

Homologar uma conta Supabase real, configurar banco remoto e associação dos usuários, importar escopo validado, publicar API/frontend com HTTPS, definir precisão por serviço e prazos retroativos, configurar backups e observar desempenho com dados reais. CRUD/importação administrativa, cronograma, produtividade individual e qualidade permanecem para entregas seguintes.

Referências oficiais: [FastAPI](https://fastapi.tiangolo.com/), [validação de usuário Supabase](https://supabase.com/docs/reference/python/auth-getuser), [conexão PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres), [transações SQLAlchemy](https://docs.sqlalchemy.org/en/20/core/connections.html).
