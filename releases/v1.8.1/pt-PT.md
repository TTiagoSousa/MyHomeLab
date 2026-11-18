v1.8.1 — Falhas de serviços que se fecham sozinhas

### Correções
- **Falhas dos serviços no quadro**: quando um serviço vigiado ia abaixo, a tarefa dele ficava em Todo depois de o serviço voltar, à espera de um agente a fechar (e se o agente não tinha acesso ao quadro, nunca fechava). Agora, quando o serviço volta a responder, o MyHomeLab diz quanto tempo esteve em baixo e passa a tarefa a Verifying; estável durante 10 minutos, fecha-a em Done. Se a tarefa estiver à espera da tua resposta (ou alguém a tiver mudado), fica como está.
- **Falhas durante uma atualização**: enquanto uma app (ou o Proxmox do servidor) está a ser atualizada, o serviço ir abaixo uns minutos já não abre uma tarefa de falha — fica dito na tarefa da atualização. A notificação continua a abrir e a fechar sozinha.
