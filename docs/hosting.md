# Hospedagem simples para o primeiro uso real

Recomendação: **Railway para os dois serviços + Supabase para PostgreSQL e autenticação + GitHub Actions para as rotinas**. Essa composição preserva a arquitetura atual e evita reescrever autenticação ou banco.

## Estimativa de custo mensal

Valores são estimativas para um MVP de baixo tráfego em 25/10/2026. As páginas oficiais de Railway, Supabase, Vercel, Render e OpenAI foram bloqueadas pela política de rede desta sessão, portanto confirme os preços atuais antes de contratar.

| Serviço | Início estimado | Quando cresce |
| --- | ---: | --- |
| Railway, web + API | aproximadamente **US$ 5–10/mês** conforme consumo e mínimo do plano | CPU, memória, tráfego e dois serviços aumentam o uso |
| Supabase Free | **US$ 0/mês** dentro das cotas vigentes | plano Pro é historicamente cerca de **US$ 25/mês**, mas deve ser confirmado |
| GitHub Actions | **US$ 0/mês** dentro da franquia do repositório | cobrança após exceder minutos/armazenamento incluídos |
| Meta Instagram API | normalmente **sem tarifa por chamada** | exige conta profissional, aplicativo, permissões e possivelmente revisão da Meta |
| OpenAI | **US$ 0 enquanto `AI_ENABLED=false`** | pagamento por uso quando autorizado; definir teto mensal antes de habilitar |
| Domínio | opcional, tipicamente **R$ 40–100/ano** | varia por registrador e extensão |

O primeiro cenário realista é aproximadamente **US$ 5–10/mês**, sem OpenAI e usando a cota gratuita do Supabase. Se o Supabase precisar do plano pago, o total tende a partir de aproximadamente **US$ 30–35/mês**, além de domínio e consumo de IA.

## Implantação

1. Publicar o commit validado em uma branch GitHub e criar um projeto Supabase dedicado.
2. Aplicar `supabase/migrations/001_initial.sql`, criar o usuário proprietário no Supabase Auth e executar `scripts/bootstrap_workspace.py` com o UUID real.
3. Criar dois serviços Railway a partir do mesmo repositório:
   - API: Dockerfile `deploy/Dockerfile.api`, healthcheck `/health` e domínio HTTPS privado/público conforme a ligação com a web.
   - Web: Dockerfile `deploy/Dockerfile.web`, domínio HTTPS público e `BACKEND_URL` apontando para a URL interna da API.
4. Fazer o build da web com as variáveis públicas do Supabase. Definir `APP_ORIGIN` como a origem HTTPS exata da web.
5. Validar login, associação à empresa, RLS, fluxo Radar–Calendário e exportação em produção antes de incluir credenciais Meta ou OpenAI.
6. Ativar o GitHub Actions somente depois de configurar banco e empresa e observar uma execução manual bem-sucedida.

## Configurações solicitadas ao operador

Não envie valores secretos pelo chat; cadastre-os nos painéis dos serviços.

| Nome | Onde | Tipo |
| --- | --- | --- |
| `DATABASE_URL` | Railway API e GitHub secret | segredo; conexão PostgreSQL Supabase com SSL |
| `SUPABASE_URL` | API, web e GitHub variable | URL do projeto |
| `SUPABASE_ANON_KEY` | API e GitHub secret | chave pública usada pelo servidor para validar sessão |
| `NEXT_PUBLIC_SUPABASE_URL` | build da web | pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build da web | pública/anon |
| `APP_MODE=production` | API e web | não secreta |
| `NEXT_PUBLIC_AUTH_MODE=supabase` | build da web | não secreta |
| `APP_ORIGIN` | web | URL HTTPS pública exata |
| `BACKEND_URL` | web | URL interna da API |
| `WORKSPACE_ID` | GitHub variable | UUID criado no provisionamento |
| `ENABLE_AGENT_AUTOMATION=true` | GitHub variable | ativar somente após teste manual |
| `TZ=America/Fortaleza` | API | não secreta |

Opcionais, somente quando forem autorizados e testados: `OPENAI_API_KEY`, `AI_ENABLED=true`, `OPENAI_MODEL`, `AI_MAX_OUTPUT_TOKENS`, `BRAVE_SEARCH_API_KEY`, `SEARCH_ENABLED=true`, `META_API_VERSION`, `META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_WORKSPACE_ID`, `META_APP_ID` e `META_APP_SECRET`.

O banco SQLite atual é um artefato de desenvolvimento. Faça backup antes da implantação e mantenha-o como histórico. A produção começa no PostgreSQL; migrar os registros existentes deve ser uma etapa controlada, com contagens e IDs conferidos antes de trocar o tráfego.
