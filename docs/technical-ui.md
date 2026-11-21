# Interface técnica — CDP CLARO

## Arquitetura

React, TypeScript e Tailwind 4, com tokens semânticos em `frontend/src/index.css`. A configuração usa `@theme inline`; não há configuração Tailwind JavaScript paralela. A implementação segue a paleta Azul Petróleo, superfícies técnicas Light/Dark e geometria de 4–8 px. Não utiliza gradientes, sombras de elevação ou ilustrações.

- `ThemeProvider.tsx` aplica preferência claro/escuro/sistema; acompanha alterações do sistema e de outras abas. Armazenamento indisponível não impede a troca na sessão. `index.html` aplica tema e color-scheme antes de carregar React/estilos, evitando flash claro.
- Inter Variable e JetBrains Mono Variable são servidas localmente, com dois arquivos WOFF2 provenientes de dependências com versões fixas e licenças OFL. Números tabulares são herdados globalmente; códigos e datas técnicas usam monoespaçada.
- `components/layout/AppShell.tsx`: sidebar 240 px / 64 px persistida, topbar 56 px, breadcrumbs, busca e perfil. Abaixo de 1024 px, a navegação usa dialog modal nativo com foco contido, Escape e fechamento após navegação. Movimento de 150 ms respeita a preferência por movimento reduzido.
- `GlobalSearch.tsx`: Ctrl/Cmd+K, busca por páginas e elementos/atividades do escopo, normalização de acentos e links diretos ao elemento. Resultados respeitam o catálogo acessível da obra; páginas administrativas só aparecem para administradores.
- `navigation.ts`: agrupamento em visão geral, operação de campo e estrutura da obra. O seletor de projeto identifica a única obra configurada; não simula alternância entre obras inexistentes.

## Componentes e páginas

Botões e inputs com raio de 4 px, superfícies com bordas de 1 px e raio de 6 px. Indicadores semânticos usam badges contidos com ponto, texto e borda. As cores semânticas especificadas são preservadas; variantes de tinta mais escuras no tema claro garantem contraste de textos pequenos.

Dashboard com indicadores agrupados, barras de 4 px e detalhamento por local recolhível. Tabelas de produção e escopo têm cabeçalho e primeira coluna fixos, alinhamento numérico à direita e rolagem interna. Histórico usa lista compacta com metadados expandíveis, preservando observações, correções e identificadores. Produção mantém a seleção em cascata e adiciona sufixo percentual ao campo. Efetivo, catálogo, administração, login e diálogos usam os mesmos tokens.

O painel de avisos mostra o estado real do ambiente e erros das consultas da sessão. Não há alertas de prazo/qualidade nem central persistente de notificações neste MVP. Não são exibidas variações de KPI sem uma base histórica que permita calculá-las.

## Verificação

- `npm run check`: lint, formatação, 32 testes e build de produção aprovados.
- Edge: sete rotas em seis larguras (375, 390, 768, 1024, 1440 e 2560 px), sem overflow horizontal da página. A rolagem horizontal permanece restrita às tabelas.
- Troca e persistência do tema e da sidebar, Ctrl+K, busca de elemento e remoção do filtro, drawer/Escape, apontamento em cascata e consulta no histórico verificados no navegador.
- Axe-core 4.14.1: zero violações encontradas nas 14 verificações de sete páginas em dois temas, com regras WCAG 2 A/AA e 2.1 AA. Mais quatro verificações do formulário administrativo real (Light/Dark × 390/1440 px), além do drawer e da busca no mobile, sem violações. Isso registra o resultado das verificações automatizadas, não uma certificação completa de acessibilidade.
- Formulário administrativo gravou no PostgreSQL local por meio da API FastAPI e preservou o cadastro após recarregar. Apenas a autenticação externa foi simulada com uma identidade fictícia; não houve alteração em um projeto Supabase remoto.

## Versionamento

Branch `frontend/technical-redesign`, baseada em `feature/catalog-admin`. O backend da importação CSV permanece isolado em `feature/scope-csv-import` e não é dependência deste redesign. A main não foi modificada.
