# Contrato proposto da API de Produção

Proposta para validação com o responsável pelo backend. Ainda não há API implementada neste repositório. Os tipos em `frontend/src/features/production/types.ts` e o adaptador HTTP seguem este documento.

## Convenções

- Base: `/api/v1`. Identificadores opacos representados por strings.
- Rotas abaixo precedidas por `/projects/{project_id}`.
- Autenticação: `Authorization: Bearer <access_token>`. Backend valida o token e a autorização para a obra em todas as operações; autor é derivado da sessão, nunca do payload.
- Quantidades e percentuais: strings decimais com ponto, sem separadores de milhar. Percentual adicional do dia, maior que 0 e até 100, com até duas casas. Quantidade calculada pelo servidor em decimal, com precisão acordada por unidade (proposta: até seis casas), nunca por ponto flutuante binário.
- Data da execução: `YYYY-MM-DD` no calendário da obra, inicialmente America/Sao_Paulo. Timestamps: ISO 8601 UTC. Datas futuras rejeitadas; regra de retroatividade precisa ser validada com engenharia.
- Consultas de cadastros devolvem apenas itens ativos e pertinentes à seleção, ordenados por nome. Listas desta etapa são completas, sem paginação; se necessário paginar, ajustar também o cliente.
- CORS permite as origens autorizadas e os headers Authorization, Content-Type e Idempotency-Key. Nenhuma credencial administrativa no navegador.

## Consultas

| Método e rota | Filtros obrigatórios | Resposta |
| --- | --- | --- |
| GET /floors | nenhum | lista de opções |
| GET /environments | floor_id | lista de opções |
| GET /disciplines | environment_id | disciplinas presentes no ambiente |
| GET /activities | environment_id e discipline_id | atividades do escopo selecionado |
| GET /scope-items | environment_id e activity_id | elementos com saldo atual |

Formato das opções:

```json
{"items":[{"id":"floor-2","name":"2º andar"}]}
```

Formato do escopo:

```json
{"items":[{"id":"scope-1","element_code":"PAR-01","element_name":"Parede leste","measurement_type":"percentage","unit":"m2","planned_quantity":"10","executed_quantity":"4","version":1}]}
```

`measurement_type`: `percentage` ou `unit`. Unidades iniciais: `m2`, `m`, `un`. Cada item unitário identifica uma unidade física, com previsto igual a 1. Previsto sempre maior que zero; executado entre zero e previsto. A versão aumenta em qualquer mudança de saldo, inclusive correção ou revisão de escopo. Uma atividade pode devolver vários elementos.

## Gravação em lote

`POST /production-batches`, header obrigatório `Idempotency-Key: <UUID>`.

```json
{
  "execution_date":"2026-11-14",
  "observation":"Frente liberada",
  "entries":[
    {"scope_item_id":"scope-1","expected_version":1,"measurement_type":"percentage","daily_percentage":"25"},
    {"scope_item_id":"scope-2","expected_version":1,"measurement_type":"unit","completed":true}
  ]
}
```

- Lote deve ter ao menos um item, sem IDs repetidos. Observação opcional, até 1000 caracteres; frontend envia string vazia quando ausente.
- Servidor verifica se todos os itens pertencem à obra e ao mesmo ambiente e atividade selecionados. O exemplo ilustra as duas variantes de medição; cada lote real segue o tipo configurado no escopo da atividade.
- Percentual representa fração do total previsto, não do saldo: previsto 10, executado 4, adicional 25% resulta em incremento 2,5 e acumulado 6,5.
- Cada item gera um apontamento rastreável. Não aceitar quantidade ou autor arbitrários enviados pelo frontend.
- Operação atômica: validar versões e saldo sob transação/bloqueio apropriado. Se qualquer item falhar, não gravar nenhum item nem parte da chave de sucesso.
- Mesma chave e mesmo payload devolvem o resultado original sem duplicar. Mesma chave e payload diferente retornam 409. Idempotência deve ser persistida pelo servidor e isolada por obra e usuário; prazo de retenção a definir antes da produção.
- Comparar chave de idempotência antes de validar versões em reenvios já concluídos. Isso permite recuperar uma resposta perdida depois da gravação.
- Frontend preserva chave e payload em tentativas idênticas após erro; edição do payload gera nova chave. Botão fica desabilitado durante o envio; não há retry automático da mutação.
- Proposta de limite: 200 itens por lote. Interface atual não faz particionamento; atividades acima desse limite exigem alinhamento antes da integração.

Resposta 201 no primeiro envio e 200 em replay, com todos os itens afetados atualizados:

```json
{"batch_id":"batch-1","created_at":"2026-11-14T12:00:00Z","items":[{"id":"scope-1","element_code":"PAR-01","element_name":"Parede leste","measurement_type":"percentage","unit":"m2","planned_quantity":"10","executed_quantity":"6.5","version":2}]}
```

## Erros

```json
{"error":{"code":"SCOPE_VERSION_CONFLICT","message":"O saldo foi atualizado por outro usuário.","fields":{"entries.0.expected_version":"Atualize os elementos antes de reenviar."}}}
```

| HTTP | Código | Comportamento esperado |
| --- | --- | --- |
| 401 | AUTH_REQUIRED | renovar sessão ou solicitar login |
| 403 | FORBIDDEN | informar falta de permissão |
| 404 | NOT_FOUND | informar recurso indisponível |
| 409 | SCOPE_VERSION_CONFLICT | preservar formulário e atualizar saldo antes de reenviar |
| 409 | ALREADY_COMPLETED | impedir nova execução da unidade |
| 409 | IDEMPOTENCY_CONFLICT | não repetir com payload alterado na mesma chave |
| 422 | VALIDATION_ERROR | corrigir dados sem apagar o preenchimento |
| 500 | INTERNAL_ERROR | mensagem segura e tentativa manual com mesma chave |

FastAPI deve normalizar seus erros de validação para o envelope acima. Interface inicial exibe mensagem geral; associação de `fields` a cada campo e recuperação guiada de conflitos são tarefas pendentes.

## Fora desta entrega

Login real, histórico paginado, estornos/correções, avanço ponderado, efetivo e cadastros administrativos. Esses contratos serão definidos nas próximas tarefas. Nenhuma tela desta base grava diretamente no Supabase.
