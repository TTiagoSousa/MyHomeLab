v1.7.0 — Claude Code e API, lado a lado

### Novidades
- **Modo Misto** (Definições → IA, precisa da chave da API da Anthropic): escolhes o motor de cada tipo de trabalho — a conversa com o Jarvis, os estudos das atualizações, as instalações e verificações, os disparos agendados e os subagentes. Por omissão, o que é leve (a conversa e os estudos) vai pela API e o que é longo fica no Claude Code, com a tua subscrição. As apps com MCP (TREK, openGym) usam-no com os dois motores.
- **Trabalhos ao mesmo tempo no Claude Code**: cada trabalho no Claude Code lança processos que gastam centenas de MB, por isso agora só corre um número fixo ao mesmo tempo (Definições → IA, de 1 a 6, por omissão 2) e os outros esperam pela vez. Vale também fora do modo Misto.

### Correções
- **Memória e reinícios**: um estudo de atualização interrompido por um reinício voltava logo à fila, e um estudo que esgotava a memória deixava o backend a reiniciar mais ou menos de 15 em 15 minutos (páginas lentas, o Jarvis a parar a meio). Agora conta como tentativa falhada e só volta a tentar uma vez, 3 horas depois. Quando a memória acaba, o kernel para um processo do Claude Code em vez do backend inteiro: falha só esse pedido, com o motivo, e o resto do site continua.

### Dica
- Com vários agentes ao mesmo tempo, 2 GB de RAM é pouco para o CT: recomenda-se 4 GB (Proxmox → o CT → Resources → Memory).
