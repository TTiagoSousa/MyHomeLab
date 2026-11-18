v1.6.1 — Perguntas que já não se perdem

### Correções
- **Assistente**: a pergunta grava-se logo que a envias. Quando um pedido demora (o Jarvis a pôr vários agentes a trabalhar) e um proxy à frente do MyHomeLab corta a ligação, a página já não dá erro: continua à espera e mostra a resposta assim que estiver pronta. Se a equipa falhar, a conversa mostra "Não consegui responder" com o motivo, em vez de a pergunta desaparecer.
- **Ajuda**: tópicos novos para o openGym, o GamesTracker, o Immich, o Paperless, o solidtime e o backup do MyHomeLab, e notas sobre arrumar os documentos com o Jarvis e sobre os pedidos longos.

### Dica
- Se o MyHomeLab estiver atrás do Nginx Proxy Manager, sobe o tempo limite dele (Advanced: `proxy_read_timeout 15m; proxy_send_timeout 15m;`) para as respostas longas chegarem logo.
