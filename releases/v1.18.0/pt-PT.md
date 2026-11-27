v1.18.0 — O que está tudo certo instala-se sozinho, e o assistente liga os cron jobs das atualizações

### Mudanças
- **O que está tudo certo instala-se sozinho**: depois do estudo, se está tudo certo (nada parte para ti e volta-se atrás), a atualização passa logo a "Ready to update" e instala-se. O que faltar e tiver uma solução segura, como um backup ou espaço livre, resolve-se no início da instalação. Um salto major, risco alto, passos à mão ou uma atualização do Proxmox sem risco baixo continuam em "Waiting for reply", à espera do teu sim.
- **Sempre em "Espera por estudo"**: nas opções do cron job das atualizações escolhes só o projeto. As versões novas entram sempre em "Espera por estudo" e o disparo "Estudar …" aparece sozinho nos Disparos do projeto.
- **Pede ao assistente**: no chat, o assistente mostra e liga, muda ou desliga o cron job das atualizações de cada app.
