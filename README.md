# Um Conto · Inteligência & Crescimento

Plataforma própria de pesquisa, estratégia e conteúdo para **Um Conto Só Seu**, com estrutura de empresas isoladas para expansão futura. Next.js + TypeScript no dashboard, Python nos agentes e PostgreSQL/Supabase em produção. **Sem dependência do Metricool.**

A aventura começa com o seu nome.

## O que funciona

- Dashboard responsivo com oito áreas, estados reais, contadores, falhas e histórico.
- **Radar:** pesquisa pública por RSS nos seis temas da marca; links, trechos, datas, origem, deduplicação e classificação por afinidade. Inclusão manual de artigos, concorrentes, criadores, comunidades e profissionais. Busca Brave opcional.
- **Estrategista:** recomendações justificadas e vinculadas a evidências; modo heurístico local e conector OpenAI com saída estruturada e validação de referências.
- **Criativo:** rascunhos de contos, Reels, legendas, carrosséis, Stories e campanhas. Modelo editorial local limitado; criação por IA quando habilitada. Edição, aprovação por versão e calendário interno.
- Histórico de pesquisas e execuções, relatório CSV de oportunidades e auditoria de decisões.
- CRM básico: clientes, solicitações, pedidos, valor e estágio confirmado pelo responsável. Nenhuma cobrança ou mensagem automática.
- Configuração e pausa dos agentes; workflow recorrente do GitHub Actions preparado e desativado por padrão.
- Adaptador oficial de leitura de conta Instagram, snapshots e comparação entre coletas, condicionado a credenciais e permissões.
- Esquema PostgreSQL, migração Supabase com RLS e autenticação por empresa. SQLite para usar o MVP sem serviços externos.

## Executar localmente

Requisitos: Node.js 24, Python 3.12+, npm e acesso aos registries de pacotes. Não é necessário contratar serviços.

```bash
cd /workspace/Umcontososeu
cp .env.example .env  # apenas se .env ainda não existir
bash scripts/setup.sh
```

Em um terminal:

```bash
.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Em outro:

```bash
npm run dev
```

O dashboard atende na porta **3000** e a API na **8000**. O OpenAPI está em `/docs` da API no modo local; `/health` confirma conectividade do banco. Para build otimizado: `npm run build && npm run start`.

O banco local é `data/umconto.db`, ignorado pelo Git. A primeira execução cria somente a empresa e as configurações dos agentes; não semeia concorrentes, métricas ou clientes fictícios. Os testes usam bancos separados e fontes sintéticas identificadas. Processos precisam ser iniciados novamente ao abrir outra máquina; não se presume que sobrevivam à publicação do ambiente.

### Preservar código e banco

O código deve ser preservado em commit Git e enviado a uma branch do GitHub depois de revisão. O banco não entra no Git: crie um backup consistente com:

```bash
.venv/bin/python scripts/backup_sqlite.py \
  --output /workspace/shared/umconto-backups/umconto-AAAA-MM-DD.sqlite
```

O comando recusa sobrescrever um backup, executa `PRAGMA integrity_check` e grava um manifesto com SHA-256 e contagens. Copiar o arquivo enquanto o servidor escreve pode produzir uma cópia inconsistente; use o script. A publicação deste ambiente cria um snapshot do filesystem preparado, mas processos precisam ser reiniciados. Para produção, use PostgreSQL/Supabase e política própria de backups.

## Primeiro fluxo

1. No Radar, execute a pesquisa ou registre uma fonte pública com seu trecho de evidência.
2. Em Relatórios, execute **Analisar evidências**. Cada recomendação explica motivo, ação e referência.
3. No Estúdio, escolha o formato e envie um brief. Revise o rascunho antes de aprovar.
4. A versão aprovada pode receber uma data no Calendário, em **America/Fortaleza**. Isso é um plano interno, não uma postagem agendada na Meta.

Os contadores indicam registros encontrados, não demanda validada. Os dados de Instagram ausentes aparecem como indisponíveis. Uma fonte adicionada manualmente não passa a ser um fato verificado.

## OpenAI e busca opcional

Configure `OPENAI_API_KEY` no servidor e altere `AI_ENABLED=true` somente quando decidir autorizar o consumo da API. O padrão é desativado. Modelo padrão configurável: `gpt-4.1-mini`; limite de saída: `AI_MAX_OUTPUT_TOKENS`. O aplicativo usa Responses API, JSON estruturado e `store=false`. Só briefs, identidade editorial e evidências selecionadas são enviados; o CRM não é enviado aos agentes. Não coloque dados pessoais de crianças no brief.

Brave Search exige `BRAVE_SEARCH_API_KEY` e `SEARCH_ENABLED=true`. Não é necessário para RSS. A busca retorna candidatos públicos, sujeitos à verificação humana. Consulte os preços e cotas do serviço antes de habilitar; nenhum serviço pago foi contratado.

As variáveis e seus papéis estão em [.env.example](.env.example). Nunca versionar `.env`, tokens ou URLs de banco com senha. Não compartilhar valores de credenciais no chat.

## PostgreSQL e Supabase

1. Use um projeto Supabase apropriado (o MVP pode começar na cota gratuita disponível). Aplique uma vez [001_initial.sql](supabase/migrations/001_initial.sql) em um projeto dedicado; não execute sobre tabelas preexistentes sem revisão/migração.
2. Configure `DATABASE_URL` com a conexão PostgreSQL do servidor e TLS, `SUPABASE_URL` e `SUPABASE_ANON_KEY`. Para SQLAlchemy use o prefixo `postgresql+psycopg://`. O modo local não migra automaticamente os dados SQLite para Supabase.
3. Crie o usuário pelo Supabase Auth e provisione a empresa usando seu ID real:

```bash
.venv/bin/python -m scripts.bootstrap_workspace \
  --name 'Um Conto Só Seu' --handle '@umcontososeu' \
  --segment 'Literatura infantil personalizada' \
  --themes 'Literatura infantil,Livros personalizados,Histórias para dormir,Maternidade,Educação infantil,Presentes personalizados' \
  --voice 'Acolhedora, imaginativa e gentil. A aventura começa com o seu nome.' \
  --owner-user-id ID_REAL_DO_USUARIO
```

4. Defina `APP_MODE=production`, `NEXT_PUBLIC_AUTH_MODE=supabase`, `APP_ORIGIN` como a origem HTTPS exata, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Refaça o build. Somente a URL e a chave pública anon do Supabase vão ao navegador; a conexão do banco e os tokens de integrações ficam no backend.
5. Na tela de acesso, entre com o usuário da plataforma e o ID da empresa retornado. O backend verifica a associação. Nunca publique o modo local.

O banco pode atender várias empresas; onboarding público, seleção de empresa pela UI, cobrança de assinatura e OAuth por conta ainda precisam ser desenvolvidos antes de vender o SaaS. Veja [arquitetura](docs/architecture.md).

## Tarefas recorrentes

`.github/workflows/research.yml` dispara a cada seis horas (minuto 17, UTC), respeitando intervalos e pausas de cada agente. O GitHub pode atrasar cron; não é uma garantia de horário exato. Por padrão, o job é ignorado.

Para habilitar depois de publicar o código no GitHub, configure:

- Variáveis do repositório: `ENABLE_AGENT_AUTOMATION=true`, `SUPABASE_URL`, `WORKSPACE_ID`.
- Secrets: `DATABASE_URL`, `SUPABASE_ANON_KEY`.
- Banco migrado, empresa provisionada e disponibilidade da cota do GitHub Actions.

O workflow executa apenas Radar e Estrategista. OpenAI permanece desligada no cron; Criativo e publicação não são automatizados. O dashboard não afirma uma próxima execução enquanto não dispõe de confirmação do agendador externo. O workflow não foi ativado ou executado no GitHub durante esta implementação.

## Testes

```bash
.venv/bin/python -m pytest -q
.venv/bin/ruff check backend
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de navegador iniciam servidores próprios nas portas 3001 e 8011 e usam banco temporário. Em ambiente com Chromium existente, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Relatório desta implementação: [validação](docs/validation.md).

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `app/`, `components/dashboard.tsx`, `lib/types.ts` | Interface, estilos, autenticação e proxy Next.js |
| `backend/app/` | API, isolamento, modelos, agentes, fontes, OpenAI, Meta e agendador |
| `backend/tests/`, `tests/e2e/` | Testes funcionais e de segurança dos fluxos |
| `supabase/migrations/001_initial.sql` | Tabelas, índices e políticas RLS |
| `scripts/` | Instalação e provisionamento explícito de empresa |
| `.github/workflows/` | CI e rotina de pesquisa |
| `docs/editorial.md`, `docs/editorial-review.md` | Identidade da marca e três exemplos revisados textualmente |
| `docs/architecture.md`, `docs/instagram.md` | Contratos, limites e evolução |
| `docs/real-use-validation.md`, `docs/hosting.md` | Demonstração real, classificação dos dados e implantação recomendada |
| `deploy/` | Dockerfiles separados para web e API |

## Pendências para operação pública

Conexão e validação reais de Supabase Auth hospedado, OpenAI e Meta; OAuth e armazenamento de tokens por empresa; mídia e publicação oficial com idempotência; insights de alcance, visualizações e engajamento; atribuição de conversões; dashboard de vendas mais completo; paginação e filas de trabalho. A integração Meta está descrita em [docs/instagram.md](docs/instagram.md).

Nenhuma publicação comercial, mensagem externa, follow/unfollow, cobrança ou contratação paga foi feita.
