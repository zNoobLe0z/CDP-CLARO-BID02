# Tarefas do frontend

## Entrega inicial na branch frontend/setup

- [x] React com TypeScript estrito, Vite e Tailwind.
- [x] Rotas, layout responsivo, navegação e componentes básicos.
- [x] Ambiente de demonstração explicitamente identificado.
- [x] Adaptador HTTP separado, cancelamento de consultas e mensagens de erro.
- [x] Contrato proposto de Produção com versão de saldo, lote atômico e idempotência.
- [x] Formulário inicial em cascata, percentual adicional e checklist.
- [x] Configuração de lint, formatação, testes e verificação automatizada no GitHub.

## Próximas entregas em branches próprias

1. `frontend/auth`: login real, ciclo de sessão, logout, rotas protegidas e perfis. Limpar cache por usuário ao sair/trocar sessão.
2. `frontend/producao-api`: validar contrato com backend, conectar ambiente de homologação e concluir tratamento de conflito/erros por campo; confirmar descarte de formulário ao navegar.
3. `frontend/historico`: listagem paginada, filtros, detalhe e correção rastreável com justificativa.
4. `frontend/dashboard`: avanço oficial por obra/disciplina, filtros e estados sem dados. Não somar unidades incompatíveis nem mostrar atraso sem planejamento.
5. `frontend/efetivo`: contagem por data/empresa, diferenciar zero de não informado, correção e consulta.
6. `frontend/cadastros`: manutenção de cadastros e importação inicial conforme permissões e API.
7. `frontend/piloto`: validação no canteiro, integração ponta a ponta, teclado/acessibilidade e conexão instável.

## Avanço na branch frontend/mvp-workflows

- [x] Login, logout, sessão persistente e renovação de token com SDK Supabase; configuração por ambiente.
- [x] Rotas protegidas, perfil autorizado retornado pela API e limpeza de cache ao trocar usuário/sair.
- [x] Histórico com busca, filtro por data/situação e paginação.
- [x] Correções justificadas com registro substituto, preservação do original, idempotência e controle de versão na demonstração e contrato.
- [x] Confirmação de descarte do apontamento ao navegar, validação de datas no fuso da obra e atualização manual de saldo após conflito.
- [x] Dashboard com avanço ponderado, filtros, situações de elementos e produção diária por atividade/unidade.
- [x] Efetivo por data/empresa, zero versus ausência de registro, substituição de contagem e consulta de revisões.
- [x] Consulta e busca do escopo com quantidades, unidades e pesos.
- [x] Adaptadores HTTP e testes de contrato para os novos endpoints.
- [x] Verificações locais, navegadores desktop/mobile e GitHub Actions.
- [ ] Homologar login e endpoints com Supabase e API Python reais; nenhum ambiente real foi configurado nesta entrega.
- [ ] Construir inclusão/importação e revisão administrativa do escopo após definir políticas com engenharia.
- [ ] Validar com a equipe o critério de peso, prazos retroativos, permissões de correção, precisão e volume das consultas.
- [ ] Realizar piloto em canteiro com dados reais, permissões e cópias de segurança.

As marcações desta seção representam a entrega de frontend. Posteriormente, a branch `backend/production-api` implementou API e schema PostgreSQL, com migrações, controle de concorrência e testes de integração. A homologação no Supabase remoto continua pendente; consulte `backend/README.md` e `docs/verification-api.md`. As sugestões de branches anteriores continuam úteis para dividir a homologação e os próximos incrementos.

## Fluxo de trabalho

A branch `frontend/cascade-navigation`, derivada de `frontend/mvp-workflows`, padroniza os cinco níveis de seleção em Produção, Dashboard, Histórico e consulta de Escopo. Regras e contratos adicionais estão em [Navegação em cascata](cascade-navigation.md). A homologação da API continua pendente.

- Manter frontend em `frontend/` e backend separado; alterações no contrato exigem revisão conjunta.
- Abrir branches curtas a partir da `main` atualizada; integrar por pull request revisado.
- Commits por objetivo usando `feat`, `fix`, `test`, `docs`, `refactor` ou `chore`.
- `npm ci` e `npm run check` antes de revisão; manter package-lock.json versionado.
- Não commitar .env, tokens, node_modules, dist ou arquivos temporários.
- Configurar proteção da main e verificações obrigatórias no GitHub quando a equipe conectar a entrega remota.

## Critério de aceite do primeiro fluxo real

Engenheiro autenticado seleciona ambiente e atividade, registra incremento percentual ou item unitário e recebe saldo atualizado da API. Duplo envio não duplica produção; concorrência não permite superar o saldo. Falha mantém dados preenchidos. Autor vem da sessão. Conferência manual com o engenheiro confirma quantidades.
