# Navegação em cascata

Fluxo comum em Produção, Dashboard, Histórico e Escopo e cadastros:

**Andar → Ambiente → Disciplina → Atividade → Elemento físico**

## Regras da interface

- Inicialmente apenas Andar está habilitado. Cada escolha carrega somente as opções pertencentes ao nível anterior.
- Alterar um nível limpa todos os seus descendentes. Mudar atividade mantém andar, ambiente e disciplina, mas limpa elemento.
- No apontamento, os quatro primeiros níveis são obrigatórios para exibir a medição. O último permite escolher um elemento específico ou todos os elementos da atividade para lançamento em lote.
- Nas consultas, é possível parar em qualquer nível para ver todo o contexto selecionado. Para escolher um nível mais específico, seus ancestrais precisam estar selecionados.
- Produção pede confirmação antes de descartar medições ou observações ao mudar de contexto. Cancelar a confirmação preserva a seleção e o preenchimento.
- O caminho selecionado fica visível. Limpar seleção reinicia os cinco níveis.
- Níveis vazios apresentam mensagem específica; falhas de carregamento permitem tentar novamente.
- Consultas usam chaves de cache com obra e ancestralidade e recebem AbortSignal. Uma resposta atrasada não pode preencher opções de outro contexto.
- Seleções que deixaram de existir são identificadas; gravação fica bloqueada até corrigir o caminho. O frontend não substitui autorização nem validações do backend.

## Contratos da API

Consultas em cascata já previstas em api-production.md: floors, environments por floor_id, disciplines por environment_id, activities por environment_id e discipline_id, scope-items por environment_id e activity_id. O retorno de scope-items identifica o elemento por id, element_code e element_name.

Histórico e dashboard passam a aceitar os cinco filtros opcionais: floor_id, environment_id, discipline_id, activity_id e scope_item_id. Valores vazios são omitidos. Os filtros são combinados por interseção; nunca ignorar um filtro informado. O servidor deve validar existência, pertencimento à obra e coerência das relações, retornando erro para combinações inválidas. Filtros não são concessão de permissão: usuário precisa continuar autorizado para a obra e operação.

Na demonstração, os mesmos filtros são aplicados por interseção ao escopo. Combinação sem correspondência produz resultado vazio, sem ampliar silenciosamente o contexto. No modo API, os novos filtros precisam ser homologados com o responsável pelo backend antes de usar dados reais.

## Verificação

Testes cobrem limpeza de descendentes, bloqueio de saltos, cancelamento de consulta anterior e resposta tardia, filtros de histórico e dashboard por atividade/elemento e envio dos parâmetros HTTP.

No navegador, foi selecionado apenas PAR-02, lançado avanço adicional de 10% sobre 12 m² e confirmado registro de 1,2 m². O dashboard desse elemento mostrou 10%; histórico e catálogo mostraram somente o elemento escolhido. Cancelar troca de andar preservou a medição; confirmar após salvar limpou os descendentes e apresentou o andar sem ambientes. Capturas desktop/mobile revisadas, sem rolagem horizontal nas telas conferidas e sem erros no console.

Efetivo mantém seleção por data e empresa, pois a contagem desta etapa é diária por empresa, sem alocação a ambientes.
