# Autenticação do frontend

O modo `api` utiliza Supabase Auth com e-mail e senha, sessão persistente e renovação automática do token. O modo `demo` permanece explicitamente separado e não exige login nem acessa o Supabase.

## Configuração

Em `frontend/.env.local`, configurar `VITE_DATA_SOURCE=api`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL` e `VITE_PROJECT_ID`. Usar somente a chave publicável do projeto. Não usar service_role ou secret key. Contas devem ser previamente liberadas pela administração; cadastro público e recuperação de senha não fazem parte desta etapa.

Não há um projeto Supabase configurado ou criado por esta entrega. O teste com uma conta real depende dessas configurações e de uma API compatível.

## Comportamento

- Visitantes são enviados a `/login`; após entrar, voltam ao destino solicitado.
- Senhas aceitam colar e preenchimento por gerenciadores; não são registradas no histórico ou em logs.
- O token da sessão atual é enviado exclusivamente no header Authorization das chamadas à API.
- Trocar usuário ou encerrar a sessão cancela consultas e limpa o cache de dados privados.
- Sair encerra a sessão deste dispositivo. Tokens de acesso já emitidos precisam ser tratados também pelo backend, conforme sua política de validade.
- A proteção visual de rotas não substitui autorização do servidor. O backend deve verificar token, acesso à obra e permissões em cada operação.
- Papéis de acesso devem vir da API de associação à obra; nunca de user_metadata editável pelo usuário.
- A sessão usa o armazenamento do SDK no navegador; não incluir scripts não confiáveis. O backend nunca deve confiar em dados locais como prova de autorização.

## Verificação

Testes cobrem redirecionamento de visitante, falha de login sem perda do e-mail, preenchimento por gerenciador de senhas e limpeza de cache nas mudanças de usuário e saída. A homologação com Supabase real permanece necessária após a configuração do ambiente.
