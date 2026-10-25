# Validação da implementação

Realizada em 25/10/2026, ambiente de desenvolvimento em nuvem. Nenhum serviço pago, publicação externa, mensagem comercial ou cobrança foi executado.

| Verificação | Resultado |
| --- | --- |
| Testes Python (`pytest`) | **19 passaram**, nenhum ignorado; um aviso de depreciação do TestClient/httpx |
| Ruff | Aprovado para backend e scripts |
| TypeScript (`tsc --noEmit`) | Aprovado |
| Build de produção Next.js | Aprovado |
| Playwright / Chromium | **3 passaram**: fluxo completo e persistência, celular sem overflow, bloqueio de origem externa |
| Auditoria npm de dependências de produção | Zero vulnerabilidades reportadas no momento da execução |
| Instalação reutilizável | `bash scripts/setup.sh` executado; dependências com lock/hashes e banco inicializado sem apagar registros |
| API / dashboard local | Inicializados, requisições funcionais realizadas e reinício validado |
| PostgreSQL 17 em container temporário | Migração aplicada; evidência, estratégia e conteúdo persistidos |
| RLS em PostgreSQL | Papel authenticated da empresa A viu somente A; escrita direta foi rejeitada |
| Radar ao vivo | **72 evidências novas**: 12 por tema, seis temas, execução concluída |
| Estrategista ao vivo | **5 recomendações heurísticas** vinculadas às evidências reais |
| Criativo local | **1 conto em rascunho**, sem aprovação/publicação, salvo no banco de desenvolvimento |

Os testes Python cobrem origem/Host local, autenticação e associação a empresa, bloqueio do papel viewer, referências entre empresas, deduplicação de fontes, falha parcial de RSS, ausência de resultados inventados, rastreabilidade das recomendações, rejeição de citações inexistentes da IA, redação de erros sem tokens, aprovação e conflito de versões, invalidação após edição, calendário com fuso e data futura, confirmação financeira e exclusão de dados de cliente. Também verificam o contrato do adaptador Meta com respostas simuladas e que a busca opcional não visita perfis retornados.

Os testes de navegador usam evidências explicitamente sintéticas e um banco temporário separado. As capturas em `artifacts/` são artefatos locais ignorados pelo Git; não são provas de desempenho comercial. A amostra da pesquisa real está em [research-validation.md](research-validation.md), e o banco local mantém o restante.

## Correções verificadas

Os testes encontraram dois defeitos durante a implementação: ordenação da exclusão de cliente e pedidos, e comparação de Origin com uma origem normalizada internamente pelo Next.js. A exclusão agora confirma a remoção dos pedidos antes do cliente; o proxy usa Host validado no modo local e APP_ORIGIN explícita em produção. Os testes correspondentes passaram após a correção. O conteúdo usa versionamento otimista para impedir que uma gravação obsoleta substitua uma revisão nova.

## Integrações ainda não validadas ao vivo

- **Supabase hospedado:** migração e políticas foram testadas em PostgreSQL com contexto de autenticação simulado. Login de um usuário real Supabase, envio de e-mail e configuração do projeto não foram testados por ausência de credenciais.
- **OpenAI:** conector implementado, resposta estruturada e referências validadas por testes, mas nenhuma chamada de inferência foi feita. A consulta à documentação em platform.openai.com falhou no proxy; o contrato ainda deve ser validado com credencial autorizada antes de habilitar consumo.
- **Meta:** foram consultados com sucesso os guias oficiais Instagram Login, Get Started e IG User. Eles documentam conta profissional, escopos instagram_business_basic / instagram_business_content_publish, host graph.instagram.com e campos utilizados. A coleta de uma conta real não foi executada. OAuth, mídia e publicação continuam pendentes.
- **Brave:** conector testado com transporte simulado, sem chamada faturável.
- **GitHub Actions:** YAML criado; rotina não ativada nem executada remotamente.

O banco PostgreSQL temporário de teste foi encerrado. O ambiente atual usa SQLite e não depende do container para iniciar. Não houve publicação do ambiente nem teste de restauração em uma tarefa nova.
