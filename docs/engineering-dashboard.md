# Central de engenharia

O dashboard utiliza os dados físicos existentes. Cronograma planejado, orçamento, custos e caixa não estão disponíveis no contrato atual: não são simulados e não há cálculo de SPI/CPI. O peso de produção continua representando esforço/relevância, independente de dinheiro.

## Componentes

- `DashboardPage.tsx`: contexto, período, cascata e consultas independentes.
- `widgets/KpiStrip.tsx`: avanço acumulado, evolução em pontos percentuais, itens concluídos e apontamentos válidos no período.
- `widgets/PhysicalProgressChart.tsx`: SVG responsivo, linha de 2 px, área de 8%, ponteiro, slider por teclado, leitura conjunta e tabela alternativa. A ausência de planejamento é explícita.
- `widgets/DisciplineChart.tsx`: barras horizontais de avanço físico por disciplina.
- `widgets/WorkStagesTable.tsx`: frentes por ambiente/atividade, ordenação, paginação, links ao escopo e coluna principal fixa.
- `widgets/ActivityFeed.tsx`: cinco apontamentos do período, timestamp relativo e link ao registro exato.
- `widgets/Widget.tsx`: skeletons geométricos, vazio, falha isolada e retry. Atualizações falhas com cache são identificadas.
- `analytics.ts`: períodos, CSV e cálculos exclusivos da demonstração. O modo API utiliza os valores Decimal calculados pelo Python.
- `dashboard.css`: importado por `index.css`, respeitando a ordem de camadas do Tailwind e os tokens Light/Dark existentes.

## Período e acumulação

A referência define o fechamento acumulado dos KPIs e das frentes. O período define a janela da curva, sua evolução, a quantidade de apontamentos válidos e o feed. Opções: últimos 30 dias inclusivos, mês/trimestre da referência e acumulado da obra.

A evolução compara o fechamento com o saldo anterior ao primeiro dia da janela. A curva exclui originais corrigidos e inclui substitutos ativos. Ela usa os pesos do escopo cadastrado e as correções atuais; não é uma fotografia imutável de um relatório antigo. Até 62 pontos amostrados, preservando o último fechamento exato.

## API e exportação

Endpoints somente de leitura, autorizados por vínculo à obra e com os filtros em cascata:

- `GET /api/v1/projects/{project_id}/dashboard/timeline?reference_date=YYYY-MM-DD&start_date=YYYY-MM-DD`: início opcional, saldo inicial, evolução, contagem e pontos. Planejamento indisponível é explícito.
- `GET /api/v1/projects/{project_id}/dashboard/stages?reference_date=YYYY-MM-DD`: frentes e percentuais ponderados até a referência.

O catálogo e os registros são consultados em lote, sem consultas por item. O feed utiliza o histórico paginado; a busca aceita UUID exato sem remover os filtros de obra/contexto. Não há migração de banco nem novos privilégios de escrita.

Exportação de frentes acumuladas em CSV UTF-8 com BOM, ponto e vírgula, decimal pt-BR, aspas e neutralização de nomes interpretáveis como fórmulas. Download bloqueado sem dados ou durante atualização/falha. Não exporta campos financeiros inexistentes.

## Validação

- Backend: 38 testes em PostgreSQL 17, incluindo fechamento da curva igual ao resumo, saldo anterior ao período, consulta histórica, limite de pontos, autorização, filtros e links exatos.
- Frontend: 39 testes, incluindo períodos, CSV, fechamento da demonstração e loading/empty/falha parcial/retry. Lint, formatação e build aprovados.
- Edge: Light/Dark em seis larguras de 375 a 2560 px, sem overflow da página ou violações encontradas pelo axe-core 4.14.1 (WCAG 2 A/AA e 2.1 AA). Curva por teclado, frente abrindo escopo filtrado e movimento abrindo um único registro foram verificados.
- React → FastAPI → PostgreSQL local: curva em 36,5%, duas frentes e CSV baixado. Uma falha 503 induzida apenas na curva preservou frentes/feed e se recuperou pelo próprio widget.
- Contraste verificado após estabilizar a transição de tema. Autenticação externa simulada com conta fictícia; nenhum projeto Supabase remoto foi alterado.

Para habilitar indicadores financeiros e comparação prevista, ainda são necessários baseline versionada do cronograma, orçamento por etapa, custos/compromissos e critérios de apropriação definidos com a engenharia.
