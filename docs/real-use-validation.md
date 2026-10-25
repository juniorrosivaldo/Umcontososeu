# Validação do MVP para uso real

Executada em **25/10/2026**, no fuso `America/Fortaleza`, usando o banco local preservado. Nenhuma publicação externa, mensagem, cobrança ou alteração de uma conta Meta foi realizada.

## Fluxo demonstrado

1. O Radar consultou seis feeds públicos. Recebeu 72 itens, reconheceu 58 já existentes e adicionou 14 novos. Execução `61247229-0f29-47f2-a74f-d861e8caa1a7`, concluída sem erro.
2. O Estrategista local analisou as evidências por regras e criou cinco novas hipóteses. Execução `0d06d0d0-f783-4dc9-9226-4ab83f45ba66`, modo `heuristic`.
3. Uma recomendação foi vinculada à evidência pública `4c4f5a90-c5d0-4a39-9109-4599be5bd117`, título “Dia dos Pais: presentes personalizados ganham espaço entre as opções para homenagear os pais”, atribuída pelo feed a O Diário de Teresópolis e publicada no feed em 05/08/2026. Link registrado: https://news.google.com/rss/articles/CBMixAFBVV95cUxNaktwOFRsYXhQVmMyYUZ4dEZkRjFydUJaNWpnc2FUWjhKMXVsdG5jLWREY1c4NzhoQmNodkNmOHdab0FNTU9QQlBEOVpaOUNRSmJEWUFvcC16U3NUdkRzaDFuVHFqa2ZMWnFzNnNpS3gzREVZMjJUYkpxZU5RelF4SG1TQ0tFR0NCMEFHSWtJMC1iaFR4THJEaEYwTW1hbTJ5U1J6QTltSXU4YVVXUEdoYV84NlFXbTl3emFBcEVrLUFETXVF?oc=5
4. O Criativo produziu um carrossel em modo `editorial_template`, pois não existe `OPENAI_API_KEY`. O conteúdo `0a3f1664-753c-4968-b90b-2445517d3df1` está explicitamente nomeado `[DEMONSTRAÇÃO MVP] Carrossel de oportunidade`. O texto é uma simulação editorial e não comprova a qualidade de uma geração por IA.
5. O responsável local simulou a aprovação da versão registrada. O item foi planejado internamente para **26/10/2026 às 19h30 em Fortaleza**. O instante persistido é `2026-10-26T22:30:00+00:00`. O calendário não publicou nem agendou na Meta.
6. O relatório CSV foi exportado com 86 linhas de evidência e sete colunas: título, tema, afinidade, justificativa, fonte, origem e data de registro. O arquivo validado está em `artifacts/real-use-opportunities.csv` e é ignorado pelo Git por conter dados operacionais.

## O que é real, derivado ou simulado

| Item | Natureza | Limite |
| --- | --- | --- |
| Títulos, links, veículos e datas dos 86 registros | Recebidos de feeds públicos | O sistema não abriu nem verificou o conteúdo integral dos artigos |
| Afinidade 0–100 | Heurística local | Não mede demanda, vendas, reputação ou tendência estatística |
| Recomendações | Derivadas por regras das evidências | São hipóteses para teste humano |
| Carrossel demonstrativo | Modelo editorial local simulado | Não usou OpenAI e ainda precisa de revisão editorial real e mídia |
| Aprovação e calendário | Ação administrativa local simulada | Não equivale a aprovação comercial real nem publicação externa |
| Seguidores, alcance, visualizações, interações e conversões | Ausentes | Dependem da conta Meta, permissões e APIs oficiais |

Durante a captura, o horário apareceu inicialmente como 16h30. A validação encontrou que o SQLite descartava o deslocamento do fuso. O backend passou a normalizar o instante para UTC e a permitir reagendamento da versão aprovada. Após a correção, os 19 testes Python passaram e a captura do calendário mostrou 19h30 em Fortaleza.

## Prévia

As capturas atuais estão em `artifacts/real-preview/`: Central de comando, Radar, Relatórios e Calendário. Elas foram produzidas por Chromium contra os serviços reais locais e não registraram erros de página. O onboarding da nuvem não publica URLs para `localhost`; uma URL HTTPS interativa só existirá após a implantação com autenticação.
