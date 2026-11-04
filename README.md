# CDP-CLARO-BID02
um programa para auxiliar os engenheiros da obra a controlar o percentual executado de cada atividade, a produção por funcionário, e controle de qualidade
# 🚧 Projeto Prodigy | Controle de Avanço Físico

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Streamlit](https://img.shields.io/badge/Streamlit-FF4B4B?style=for-the-badge&logo=streamlit&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

Uma aplicação web desenvolvida para a gestão e acompanhamento diário da produção em canteiros de obras. O sistema substitui pranchetas e planilhas complexas por uma interface ágil, permitindo que os engenheiros lancem os dados de execução diretamente da frente de serviço.

## 🎯 Objetivo do Projeto

O controle de avanço físico tradicionalmente sofre com a lentidão no fluxo de informações entre o canteiro e o escritório. O **Prodigy** foi criado com foco em **mobilidade e agilidade**: por ser uma aplicação web responsiva, pode ser acessado via celular ou tablet durante as vistorias na obra, e também pelo computador para análises gerenciais mais profundas.

O sistema calcula automaticamente o percentual de conclusão da obra com base no peso e na metragem de cada atividade executada diariamente.

## ✨ Funcionalidades Principais

- **Lançamento Mobile-First:** Interface limpa e otimizada para uso em telas menores, facilitando o *data entry* na correria da obra.
- **Rastreabilidade por Usuário:** Registro de qual engenheiro realizou a medição, garantindo histórico e responsabilidade diária.
- **Cálculo de Avanço Físico:** Atualização em tempo real do percentual da obra e de cada serviço com base na geometria executada (metragens, áreas, etc).
- **Banco de Dados Relacional:** Estrutura otimizada em PostgreSQL separando Ambientes, Geometria (Escopo) e Histórico de Medições para alta performance e escalabilidade.

## 🛠️ Tecnologias Utilizadas

- **Frontend / Interface:** [Streamlit](https://streamlit.io/) (Python)
- **Backend / Lógica:** Python (Pandas)
- **Banco de Dados:** PostgreSQL hospedado no [Supabase](https://supabase.com/)
- **Controle de Versão:** Git & GitHub

## 🚀 Como executar o projeto localmente

Pré-requisitos: Python 3.9+ e Git instalados.

1. Clone o repositório:
```bash
git clone [https://github.com/SEU-USUARIO/nome-do-repositorio.git](https://github.com/SEU-USUARIO/nome-do-repositorio.git)
