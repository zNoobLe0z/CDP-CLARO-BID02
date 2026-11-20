# Contratos propostos de dashboard e efetivo

Estas rotas foram implementadas em `backend/` e verificadas localmente em PostgreSQL. A homologação no ambiente real continua pendente. Frontend possui adaptadores e demonstração em memória. Todas as rotas abaixo usam `/api/v1/projects/{project_id}` e exigem autenticação e autorização da obra.

## Dashboard

`GET /dashboard?reference_date=YYYY-MM-DD&floor_id=...&environment_id=...&discipline_id=...`

Data de referência obrigatória, válida e não futura no calendário da obra. Filtros vazios são omitidos. A resposta segue `DashboardData` em `frontend/src/features/dashboard/types.ts`:

```json
{
  "reference_date":"2026-11-20",
  "overall_percentage":"32.0000",
  "total_items":4,
  "not_started_items":2,
  "in_progress_items":1,
  "completed_items":1,
  "disciplines":[{"id":"finishes","name":"Acabamentos","percentage":"32.0000","total_items":4,"completed_items":1}],
  "daily_production":[{"date":"2026-11-20","activity_name":"Pintura","unit":"m2","quantity":"4"}]
}
```

- Escopo é filtrado pela obra, andar, ambiente e disciplina; execução inclui somente apontamentos active com execution_date até a referência, inclusive.
- Peso é o esforço total previsto do item, decimal positivo. Avanço por item = acumulado / previsto. Percentual consolidado = soma(avanço x peso) / soma(pesos) x 100. Usar a mesma regra por disciplina.
- Sem escopo, percentual geral null e contagens zero. Escopo existente sem produção tem percentual zero.
- Quantidades são decimais; a produção diária é agrupada por data, atividade e unidade. Nunca somar m², m e un diretamente.
- Correções substituem a contribuição do original pela do substituto na data de execução original.
- Não retornar dados de outra obra nem considerar todos os usuários autenticados autorizados.
- O modo API exibe o resultado oficial retornado pelo servidor; o algoritmo local em calculate.ts é somente a demonstração e os testes.
- Resposta diária é completa nesta versão; paginação ou limitação de intervalo precisa ser acordada se o volume exigir, sem truncamento silencioso.

## Empresas e contagens

`GET /companies` devolve `{ items: [{id, name}] }`, empresas ativas autorizadas para a obra.

`GET /workforce?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&company_id=...` devolve `{ items: WorkforceRecord[] }`. Período obrigatório e inclusivo. company_id vazio representa todas. Ordenação por data descendente e nome da empresa. Resposta completa, sem paginação nesta versão.

Registro contém id, company_id, company_name, execution_date, headcount, observation, author_name, updated_at e version. A interface exibe apenas dias que têm ao menos uma contagem; empresa sem registro nesse dia aparece como Não informado. Registro com headcount zero aparece como 0 pessoas.

`PUT /workforce/{execution_date}/{company_id}`, com `Idempotency-Key` obrigatório:

```json
{"headcount":5,"observation":"Conferência da equipe presente","expected_version":1}
```

- Um registro único por obra, data e empresa, sem turnos nesta etapa.
- expected_version null cria somente se não existir registro. Versão inteira atualiza somente se corresponder ao registro existente.
- headcount inteiro entre 0 e 100000; observação opcional até 1000 caracteres; data válida e não futura. Revisar limite superior com engenharia antes do piloto.
- Atualização substitui a contagem, não incrementa. Preservar versão anterior com autor, data, observação e quantidade. Incrementar version e derivar autor da sessão.
- Operação atômica com unicidade e controle de concorrência. Conflito retorna 409 WORKFORCE_VERSION_CONFLICT. Idempotência segue as mesmas regras de produção, incluindo replay antes de verificar versão.
- Responder com registro completo em 201 na criação e 200 na atualização ou replay.
- Papéis admin/editor podem registrar; viewer consulta. Política de prazo retroativo depende de engenharia.

`GET /workforce-records/{id}/revisions` devolve `{ items: WorkforceRevision[] }`, versões anteriores com version, headcount, observation, author_name e updated_at. Retorno ordenado por versão crescente. A versão atual fica no registro principal. Sem revisões, items vazio.

Efetivo não representa funcionários únicos ao longo de vários dias e não permite inferir produtividade sem horas e produção atribuída.
