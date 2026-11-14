# 🚧 CDP CLARO | Controle de Produção

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

O **CDP CLARO (Controle de Produção)** é uma aplicação web desenvolvida especificamente para a gestão e acompanhamento diário da obra CDP BI02 | CLARO. O sistema foi projetado para substituir o uso de pranchetas e planilhas complexas por uma interface ágil e nativa, permitindo que os engenheiros lancem os dados de avanço físico diretamente da frente de serviço.

Além do controle físico da obra, a ferramenta integra o acompanhamento da produtividade por funcionário e o rigoroso controle de qualidade das atividades de *fit-out* corporativo.

## 🎯 Objetivo do Projeto

O controle de avanço tradicionalmente sofre com a lentidão no fluxo de informações entre o canteiro e o escritório. Criado com foco em **mobilidade e alta performance**, o CDP CLARO permite apontamentos rápidos via celular ou tablet durante as vistorias. 

Por trás da interface, um motor robusto de engenharia cruza a geometria física da obra com pesos de produção, calculando automaticamente o percentual de conclusão de disciplinas e da obra global, eliminando completamente o erro humano e o tempo gasto em cálculos manuais de medição.

## 🏗️ Arquitetura do Sistema (Desacoplada)

O sistema foi arquitetado no padrão comercial (SaaS), separando a inteligência de dados da interface visual para garantir máxima velocidade e escalabilidade no canteiro:

1. **Frontend (A Casca):** Desenvolvido em **TypeScript e React**, garantindo uma interface *mobile-first* ultra fluida. O engenheiro no canteiro tem uma resposta visual imediata aos cliques, sem tempo de carregamento (loading) a cada apontamento.
2. **Backend (O Motor):** Desenvolvido em **Python (FastAPI)**. Funciona como o cérebro da operação, recebendo os apontamentos do celular, processando os cálculos matemáticos de engenharia e orquestrando o banco de dados.
3. **Database:** Banco de dados relacional **PostgreSQL**, estruturado em granularidade de elementos (Ambientes > Elementos Físicos > Escopo de Produção > Apontamentos).

## ✨ Funcionalidades Principais

- **Lançamento Inteligente em Cascata:** Navegação rápida no modelo Andar > Ambiente > Disciplina > Atividade.
- **Adaptação por Tipo de Serviço:** Exibe campos de avanço (%) para serviços contínuos (ex: drywall, pintura) e converte automaticamente para *checklists* binários no caso de serviços unitários (ex: portas, reforços de madeira, pontos de água).
- **Rastreabilidade e Qualidade:** Registro exato de qual usuário (engenheiro) realizou a medição e apontamento de produção vinculada a cada funcionário/empreiteiro.
- **Painel Gerencial Automático:** Cálculo em tempo real do avanço físico (% da obra e % da disciplina) assim que um apontamento é salvo no celular.

## 🛠️ Tecnologias Utilizadas

**Frontend (Interface & UX):**
- TypeScript
- React (ou Next.js)

**Backend (Regras de Negócio & API):**
- Python 3.9+
- FastAPI (Criação da API REST)
- Pandas (Processamento de tabelas e cruzamento de dados)

**Banco de Dados & Infraestrutura:**
- PostgreSQL hospedado no [Supabase](https://supabase.com/)
- Controle de Versão: Git & GitHub

## Desenvolvimento do frontend

A base React com TypeScript, Vite e Tailwind está em [frontend](frontend/README.md).

```sh
cd frontend
npm ci
npm run dev
```

Requer Node.js 24 e npm 11. O padrão é demonstração em memória, sem conexão com banco e sem autenticação real. A tela inicial permite validar o apontamento; as demais áreas estão em preparação.

- [Contrato proposto da API de Produção](docs/api-production.md)
- [Tarefas e versionamento do frontend](docs/frontend-tasks.md)

## Backend

A arquitetura prevê uma API Python com FastAPI e PostgreSQL no Supabase. A implementação do backend ainda não está presente neste repositório. Os recursos descritos acima representam os objetivos do produto, não funcionalidades já concluídas.
