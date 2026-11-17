v1.3.0 — Backups completos do MyHomeLab e um quadro de Projetos mais arrumado

### Novidades
- **Backup do MyHomeLab**: em Admin → Backup crias um backup de tudo — documentos e as ligações entre eles, agentes, tarefas, serviços, servidores, apps ligadas com os logins — num ficheiro cifrado com a tua password dos backups. Descarrega-o, ou agenda-o para o Nextcloud ou para uma pasta no próprio servidor (o novo destino "Neste servidor"). Repõe-se pela app ou com `myhomelab-restore` no servidor, com volta atrás automática se algo falhar.
- **Projetos**: o quadro ficou mais limpo — os filtros passaram para um botão "Filtros", as colunas vazias escondem-se por omissão, a descrição do projeto está num (i), a Lista começa com Done e Cancelled fechados e "Apagar tarefa" está no painel das propriedades.

### Correções
- **Projetos**: as ações em massa já não mudam tarefas escondidas pelos filtros; o filtro de etiquetas, a pesquisa com Voltar/Avançar e o título vazio de uma tarefa voltaram a funcionar bem; o separador do browser diz "MyHomeLab".
- **Servidor**: se o PostgreSQL for morto por falta de memória, volta a arrancar sozinho, e os backups diários e o das atualizações já não falham por o encontrarem parado.
