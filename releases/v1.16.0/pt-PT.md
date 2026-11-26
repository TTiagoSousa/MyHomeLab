v1.16.0 — Cada app tem o seu cron job de atualizações

### Novidades
- **Cron job de atualizações em cada app self-hosted**: cada app de que o MyHomeLab sabe ver a versão tem agora o botão "Cron jobs", com o "Atualizações da app". O Home Assistant tem também um para os add-ons, HACS e firmware, e o Nextcloud um para as apps do Nextcloud. Escolhes de quanto em quanto tempo corre e, nas Opções, ligas "Pôr no projeto" e escolhes o projeto e a coluna. Em "Espera por estudo", o estudo começa sozinho e segue o caminho de sempre (só instala com o teu sim). Em "Todo", a tarefa fica à espera até a arrastares. Corre em código, sem IA nem tokens, e apanha também as atualizações que já estavam à espera de ser abertas. Se a mesma app ou peça já tiver uma atualização aberta, a nova espera pela vez seguinte.

### Correções
- **Nomes das medidas da Saúde**: as medidas da composição corporal passam a ter os nomes habituais, como "Percentual de gordura corporal", "Massa de músculo esquelético" e "TMB", com as unidades.
