# Verificação da API e integração com o frontend

Entrega na branch backend/production-api, derivada de frontend/cascade-navigation. Implementação FastAPI e PostgreSQL, sem provisionamento ou alteração de um projeto Supabase remoto.

## Testes automatizados

28 testes do backend aprovados em PostgreSQL 17 local, incluindo validação de percentuais/datas, consulta da identidade no serviço de autenticação, negação de acesso, cascata, persistência decimal, replay idempotente, rollback integral do lote, item unitário, versões concorrentes, correção com preservação do original, dashboard e efetivo com revisões.

Testes simultâneos utilizaram conexões e requisições HTTP independentes: para o mesmo saldo com chaves diferentes, uma resposta 201 e outra 409; para replay simultâneo da mesma chave, respostas 201 e 200 com corpo idêntico, sem duplicação de registro.

Teste com login PostgreSQL restrito comprovou apontamento/correção e bloqueou criação de objetos, alteração de permissões e reescrita da quantidade original. Migrações foram aplicadas, revertidas e reaplicadas em banco descartável antes de repetir a suíte.

O frontend permanece com seus 27 testes e verificações de lint, formatação, TypeScript e build. O backend também possui workflow próprio com PostgreSQL em Python 3.12 e 3.14.

## Navegador com API e banco locais

O React foi iniciado no modo API e acessou FastAPI por HTTP, com CORS e token de sessão. Somente o serviço externo de autenticação foi simulado com conta/token fictícios. Consultas da cascata, permissão por obra, cálculos, gravações, histórico, correções e efetivo passaram pela implementação real da API e por PostgreSQL, conectado com login restrito.

1. Apontamento de 25% na parede com previsto 10 m² e executado 4 m² gravou 2,5 m² adicionais.
2. Recarregar a página manteve o acumulado em 6,5 m², comprovando persistência fora da memória do navegador.
3. Histórico apresentou o registro; corrigir 2,5 para 1,5 m² preservou o original como corrected e criou substituto active.
4. Banco consultado diretamente mostrou parede com 5,5 m² e versão 3; registros 4 active, 2,5 corrected e 1,5 active.
5. Dashboard oficial da API mostrou 36,5%, separando 5,5 m² de pintura e 1 un de portas.
6. Efetivo da empresa Beta foi criado com zero e atualizado para cinco, mantendo a revisão com zero; banco confirmou contagem cinco e versão 2.
7. Capturas de dashboard e efetivo revisadas visualmente.

Foi ajustada a confirmação de descarte do frontend para não tratar como pendente uma medição já gravada enquanto as consultas de saldo são atualizadas.

## Limites

A validação prova API, frontend e PostgreSQL locais, mas não comprova login de conta real nem operação no Supabase remoto. Não foram criados usuários reais, alteradas permissões de projetos remotos ou aplicada migração remota. Hospedagem, HTTPS, backups, importação do escopo real e validação de canteiro permanecem pendentes.
