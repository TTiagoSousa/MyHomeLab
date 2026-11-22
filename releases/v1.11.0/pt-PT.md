v1.11.0 — Aprovações no chat, routers TP-Link e muitas correções

### Novidades
- **Routers e repetidores TP-Link**: liga routers TP-Link Archer e repetidores RE para ver o estado, o Wi-Fi, os dispositivos, o DHCP, os reencaminhamentos de portas e o controlo de acesso, com ferramentas para os agentes. Se outra pessoa ficar com a sessão do router, o MyHomeLab volta a ligar-se de 5 em 5 minutos.
- **Aprovar no chat**: enviar emails, mudar a equipa, instalar atualizações e as propostas de documentos mostram agora um cartão no chat com "Sim" e "Não". Também podes simplesmente pedir ao Jarvis.
- **Atualizações sozinhas**: os agentes instalam sozinhos as atualizações pequenas e seguras e só te perguntam as importantes (versões grandes, risco alto, passos manuais ou o host Proxmox). No fim dizem o que fizeram.
- **Home Assistant**: o Engenheiro de Infraestrutura já consegue atualizar o Home Assistant.
- **Site no telemóvel**: em ecrãs pequenos o menu passa a uma gaveta.

### Correções
- **Segurança**: as sessões são confirmadas na base de dados, a API deixa de devolver os segredos das contas, os logins têm limite por IP, as chaves SSH dos servidores são verificadas na primeira ligação, os scripts do LXC e os cabeçalhos do nginx ficam mais rígidos e o `postgres_query` fica só de leitura.
- **Agentes**: quando correm sem ti só usam uma lista segura de ferramentas, o texto de emails e páginas é tratado como dados e não como ordens, e os prompts ficam mais curtos e em cache, por isso cada pedido fica mais barato. Corrigido um erro 400 quando o chat tinha cartões ou propostas por decidir.
- **Atualizações e alertas**: os estudos, as instalações e os avisos de disco já não ficam presos nem se repetem, uma atualização interrompida já não fica como instalada e atualizar o MyHomeLab espera enquanto há apps a instalar ou disparos a correr.
- **Regras de email**: as regras com REGEX passam a funcionar e, quando o Google retira o acesso, a conta desliga-se com um aviso "Voltar a ligar", em vez de falhar em silêncio.
- **Apps**: os erros de ligação dizem a causa verdadeira (certificado, porta fechada, nome não encontrado), as horas já não aparecem uma hora ao lado no verão e trocar o token já não falha no AdGuard, Forgejo, Home Assistant, Nextcloud e TREK. Mais correções no AdGuard, Forgejo, NPM, Nextcloud, Drive, TP-Link, ClickHouse e Coolify.
- **Site**: ao mudar de conversa ou de servidor já não aparecem dados do anterior, uma sessão expirada volta ao login e depois à mesma página, e o primeiro carregamento fica com cerca de metade do tamanho.
