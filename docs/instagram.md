# Integração oficial do Instagram

O MVP prepara um adaptador de **leitura**, sem Metricool. A conta é configurada por `META_IG_USER_ID`, `META_WORKSPACE_ID`, `META_API_VERSION` e `META_ACCESS_TOKEN`. O token permanece no servidor; nunca se pede a senha do Instagram. Não há conexão confirmada enquanto a chamada real não retorna os dados da conta esperada.

O adaptador em `backend/app/instagram.py` usa `graph.instagram.com`, destinado ao fluxo Instagram API with Instagram Login. Uma conta profissional (Business/Creator), um aplicativo Meta, as permissões correspondentes e uma versão suportada são pré-requisitos. Não misturar tokens do fluxo Instagram Login com o fluxo Facebook Login. Nenhuma versão foi adivinhada como padrão.

O endpoint `/instagram/sync` consulta `/me`, solicita `user_id`, `username`, `media_count` e `followers_count`, rejeita um ID diferente da conta configurada e persiste somente os valores retornados. O guia oficial Get Started consultado apresenta esses campos e exemplos com `v26.0`; a versão utilizada continua sendo uma configuração explícita do operador. A disponibilidade precisa ser confirmada com o aplicativo e suas permissões. Nenhuma coleta de conta real foi feita nesta implementação, por ausência de credenciais. Alcance, visualizações, interações, insights de mídia e conversões continuam pendentes, e a interface mostra essa ausência.

## Etapas seguintes

1. Registrar aplicativo e conta de testes na Meta, confirmar o fluxo oficial, tipo de conta e permissões atuais.
2. Implementar OAuth com estado assinado e vinculado ao usuário/empresa, callback validado e troca de token no servidor. Implementar revogação, renovação e cofre de tokens por empresa. `META_APP_ID` e `META_APP_SECRET` estão reservadas no exemplo de ambiente para esta etapa; não são usadas ainda.
3. Testar o adaptador de leitura, disponibilidade de métricas e escopos. Solicitar App Review/Business Verification quando exigidos pela Meta para atender contas externas.
4. Implementar armazenamento de mídia, validação de imagem/vídeo, limites e direitos de uso. Validar a URL de mídia contra SSRF e destinos permitidos.
5. Implementar criação de container, consulta de processamento e `media_publish` somente após aprovação da versão exata e da mídia. Registrar ID remoto, chave de idempotência, tentativas e reconciliação; não repetir automaticamente um publish cujo resultado seja ambíguo.
6. Só então conectar os itens `planned` a uma fila de publicação. Revalidar escopo comercial, conta de destino e token no momento do envio.

## Referências oficiais a validar na configuração

- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/get-started.md
- https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user.md
- https://developers.facebook.com/docs/instagram-platform/content-publishing/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/insights/
- https://platform.openai.com/docs/api-reference/responses

Essas referências orientam a integração; não constituem evidência de que a conta da marca possui permissões, conexão, loja ou vendas. O estado da consulta às documentações nesta sessão consta em `docs/validation.md`.
