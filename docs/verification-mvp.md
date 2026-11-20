# Verificação dos fluxos do frontend

## Escopo verificado

Branch frontend/mvp-workflows. Demonstração compartilhada entre produção, histórico, dashboard e consulta de escopo, com efetivo separado por empresa/data. Modo API com SDK de autenticação e endpoints interceptados em navegador para verificar contratos e permissões. Nenhuma chamada de teste foi direcionada a um banco ou projeto real.

## Verificações automatizadas

`cd frontend` e `npm run check`: lint, formatação, testes e build com TypeScript estrito. Foram executados 19 testes em oito arquivos. CI no GitHub executou a mesma sequência com sucesso em Linux/Node 24 para as três etapas funcionais.

Os testes cobrem incremento percentual, saldo excedido, atomicidade de lote, replay idempotente e chave conflitante, conflito de versão, item unitário já concluído, seleções em cascata, login e cache por sessão, correção rastreável, filtros/paginação, data de execução no fuso da obra, cálculo ponderado, unidades separadas, efetivo zero, revisões e formato das chamadas HTTP.

## Navegador com dados de demonstração

1. Dashboard inicial mostra 32%: pesos fictícios de 30, 30, 20 e 20 para quatro itens.
2. Apontamento de 25% na parede com previsto 10 m² gera incremento de 2,5 m². O diálogo de saída permite continuar preenchendo sem perder o valor.
3. Registro aparece no histórico com data, autor, quantidade e identificação do elemento.
4. Correção do incremento de 2,5 para 1,5 m² exige justificativa, preserva original como Substituído e cria registro válido substituto.
5. Dashboard passa a 36,5%, com 5,5 m² de pintura e 1 un de portas apresentados separadamente.
6. Efetivo da empresa Beta começa como Não informado. Gravar zero mostra 0 pessoas; corrigir para cinco atualiza a contagem e mantém revisão anterior com zero. Total diário, com oito da Alfa, fica em 13, sem somar a versão antiga.
7. Busca no catálogo encontra o elemento e exibe executado atualizado de 5,5 m².
8. Capturas desktop e celular de 375 pixels revisadas visualmente; sem rolagem horizontal nas telas conferidas. Console da demonstração sem erros.

## Navegador no modo API com respostas interceptadas

- Login malsucedido mantém e-mail e exibe erro recuperável.
- Login bem-sucedido volta ao destino originalmente solicitado.
- Cliente da API envia o token da sessão no header Authorization.
- Perfil viewer não recebe formulário de escrita do efetivo.
- Logout retorna à página de login. Novo login com perfil editor permite o formulário.
- Teste usa domínios example.test, conta e tokens sintéticos. O erro HTTP 400 observado no console corresponde à falha de login intencional.

## Limites

Não comprovados por esta entrega: autenticação de conta real, autorização no servidor, persistência/concorrência no PostgreSQL, políticas do Supabase, backups, desempenho com escopo real, funcionamento offline e uso no canteiro. Devem ser validados quando o engenheiro disponibilizar o backend e o ambiente de homologação.
