v1.15.0 — Os agentes já não são cortados aos cinco minutos, os comentários nas tarefas contam como resposta, e acesso pela API

### Melhorias
- **Trabalho demorado já não é cortado**: quando o Jarvis passava trabalho a outro agente, ou um agente fazia um backup ou instalava uma atualização que levava mais de cinco minutos, a chamada era cancelada. O Jarvis dizia que a ligação tinha sido cortada e o outro agente continuava sozinho, sem relatório. Agora esse trabalho vai até ao fim (até 20 minutos) e o relatório chega.
- **Os teus comentários numa tarefa são palavras tuas**: o que escreves nos comentários de uma tarefa passa a contar como se o dissesses no chat. Um "sim, apaga o vzdump-… e atualiza" nos comentários chega. Já não precisas de abrir o chat. Emails ou páginas que o agente lê continuam a nunca contar como o teu sim.

### Novidades
- **Acesso pela API**: em Definições → Acesso pela API podes criar tokens pessoais para usar o MyHomeLab sem o browser (por exemplo, a partir de um script). Um token "Só leitura" só lê; um "Completo" faz o que tu fazes no site, mas não gere tokens, sessões nem contas. O token aparece uma vez, pode ter validade e revoga-se no mesmo cartão.
