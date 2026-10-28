# Operação a custo zero

Este é o modo recomendado enquanto não houver orçamento. Ele mantém o banco SQLite e o painel no computador do operador, preserva o código no GitHub e não depende de OpenAI, Brave, Metricool ou hospedagem paga.

## O que fica funcional

- Radar por fontes RSS públicas, com links, datas, trechos e deduplicação.
- Estratégia heurística vinculada às evidências encontradas.
- Rascunhos editoriais por modelos locais, revisão, aprovação e calendário interno.
- CRM, histórico, auditoria e relatório CSV.
- Backup verificável do banco.

O painel só funciona enquanto o computador e os dois processos estiverem ligados. O calendário organiza o trabalho, mas não publica no Instagram. Publicações e interações externas permanecem manuais e supervisionadas. Métricas oficiais do Instagram dependem das credenciais da Meta; IA generativa avançada depende de uma API paga ou de uma integração futura com modelo local.

## Início diário

Na primeira utilização:

```bash
cp .env.example .env
bash scripts/setup.sh
```

Nas utilizações seguintes:

```bash
bash scripts/start_local.sh
```

Abra a porta 3000 no mesmo computador. Encerre com `Ctrl+C`. O banco continua em `data/umconto.db` depois do encerramento ou reinício.

## Rotina semanal de crescimento

1. Segunda-feira: executar o Radar e revisar as fontes; descartar resultados sem relação clara com a marca.
2. Analisar as evidências no Estrategista e selecionar de três a cinco oportunidades justificadas.
3. Criar um Reel, um carrossel e uma sequência de Stories no Estúdio; revisar linguagem, oferta e fatos.
4. Aprovar e distribuir os conteúdos no calendário. Publicar manualmente pelo aplicativo oficial do Instagram.
5. Na semana seguinte, registrar manualmente alcance, interações e pedidos disponíveis e comparar temas e formatos.

Priorize consistência e aprendizado: três publicações úteis por semana, Stories nos dias ativos e uma oferta comercial clara por semana são uma base inicial, não uma promessa de crescimento. Decisões devem usar os resultados reais registrados.

## Preservação

Depois de alterações de código, faça commit e envie para uma branch do GitHub. Ao fim de cada semana, gere um backup fora da pasta do repositório:

```bash
.venv/bin/python scripts/backup_sqlite.py \
  --output /workspace/shared/umconto-backups/umconto-AAAA-MM-DD.sqlite
```

Guarde o arquivo `.sqlite` e o manifesto `.json` juntos. O banco não deve ser adicionado ao Git.

## Evolução sem custo fixo

Uma conta gratuita do Supabase pode ser adicionada quando for necessário executar o Radar pelo GitHub Actions sem o computador ligado. Isso exige criar o projeto, aplicar a migração e cadastrar as credenciais nos painéis. As cotas e políticas gratuitas podem mudar e projetos inativos podem ser pausados. O painel pode continuar local, consultando o PostgreSQL remoto.

Não habilite OpenAI, Brave ou hospedagem pública enquanto não houver orçamento e uma necessidade validada. A Meta Instagram API não exige a senha do Instagram, mas requer conta profissional, aplicativo Meta e permissões; sua configuração pode ser feita depois sem custo de hospedagem.
