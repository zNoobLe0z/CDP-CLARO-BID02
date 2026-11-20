# Contrato proposto de histórico e correções

Complementa `api-production.md`. Implementado na API Python em `backend/`, com testes locais em PostgreSQL. A homologação de ambiente real continua pendente. Os adaptadores do frontend estão implementados; demonstração usa os mesmos formatos em memória. Rotas precedidas de `/api/v1/projects/{project_id}` e protegidas por token e autorização da obra.

## Consultar apontamentos

`GET /production-records?page=1&page_size=10&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&search=termo&status=active`

Filtros vazios são omitidos. Situação: `active`, `corrected` ou ausência para todas. Busca por código, elemento, atividade ou ambiente. Datas inclusivas pela execução. Ordenação estável por execution_date, created_at e id descendentes. Paginação numérica, page >= 1, page_size entre 1 e 100. Resposta: `{ items: ProductionRecord[], total, page, page_size }`.

`ProductionRecord` está definido em `frontend/src/features/production/history-types.ts`: ID, item do escopo, nomes, unidade, tipo de medição, quantidade decimal, data de execução, data de criação, autor derivado da sessão, observação, situação, versão do registro, versão atual do escopo, ID substituído e justificativa.

## Corrigir sem apagar o original

`POST /production-records/{id}/corrections`, header `Idempotency-Key` obrigatório.

```json
{"quantity":"2.5","reason":"Conferência da medição em campo","expected_record_version":1,"expected_scope_version":2}
```

- Quantidade informada é a produção correta daquele registro, não o acumulado do elemento.
- Quantidade não negativa com até seis casas decimais; unidade binária permite somente 0 ou 1. Não aceitar correção sem mudança de quantidade. Zero anula a produção do registro sem apagar sua trilha.
- Justificativa obrigatória entre 5 e 1000 caracteres; autor e timestamp obtidos no servidor.
- Em transação: validar acesso, situação e ambas as versões; retirar a quantidade anterior do acumulado e adicionar a nova, validando entre zero e previsto.
- Marcar original como corrected, incrementar sua versão, criar substituto active com replaces_id e correction_reason; manter quantidade, autor, data e observação do original intactos.
- Substituto mantém data da execução original, mas possui autor e data de criação próprios. Atualizar quantidade e versão do escopo.
- Retornar substituto em 201, ou resultado original em 200 para replay. Mesma semântica de idempotência do apontamento; nunca repetir o ajuste de saldo.
- Conflito de registro ou saldo: 409 SCOPE_VERSION_CONFLICT. Demais erros seguem o envelope geral. Política de prazo e permissões para corrigir precisa ser acordada com engenharia.

## Catálogo para consulta

`GET /scope-catalog` devolve `{ items: CatalogItem[] }`. O tipo inclui os campos de ScopeItem mais IDs e nomes de andar, ambiente, disciplina e atividade e production_weight (peso total do item, decimal positivo). É leitura de todo o escopo autorizado da obra; sem paginação nesta versão. Frontend ainda não oferece alteração administrativa do catálogo.

## Coerência de indicadores

Dashboard soma somente registros active. Ao corrigir, original corrected deixa de contribuir e substituto contribui na data de execução original. A consulta histórica representa valores corrigidos atualmente por data de execução, não uma fotografia do que era conhecido em uma data passada.
