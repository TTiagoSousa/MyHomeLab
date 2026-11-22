import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { targetLabel, updateLabel } from 'src/app-update/helpers/updateFields';
import { lisbon } from 'src/app-update/helpers/updateDates';
import type { StudyInput } from 'src/app-update/app-update.service';

const UPDATE = {
  type: 'string' as const,
  description:
    'A atualização: o id, a tarefa do quadro (ex.: HOMELAB-12) ou o nome da app (a em aberto).',
};

// As definições são fixas (a cache vive do prefixo igual); só os handlers leem
// as atualizações deste utilizador.
export function buildUpdatesTools(context: AgentContext): AgentTool[] {
  const agentKey = context.agentKey ?? 'infra';
  const withUpdate =
    <T extends { update: string }>(
      work: (
        update: Exclude<
          Awaited<ReturnType<typeof context.updates.findForAgent>>,
          string
        >,
        input: T,
      ) => Promise<string>,
    ) =>
    async (input: T) => {
      const update = await context.updates.findForAgent(
        context.userId,
        input.update,
      );
      return typeof update === 'string' ? update : work(update, input);
    };

  // Pôr em Ready to update instala-se logo: só com o sim dele no cartão do chat (ou
  // um "aprovo" dele numa mensagem nova, que o Jarvis decide com approval_decide).
  const proposeInstall = async (
    update: Exclude<
      Awaited<ReturnType<typeof context.updates.findForAgent>>,
      string
    >,
    comment: string,
  ): Promise<string> => {
    if (context.source !== 'chat' || !context.conversationId) {
      return 'Recusado: só o utilizador aprova uma instalação ("Sim, instalar" na tarefa ou o cartão no chat). Deixa-a em waiting com a recomendação.';
    }
    const approval = await context.approvals.create(
      context.userId,
      'UPDATE_INSTALL',
      agentKey,
      { updateId: update.id, label: updateLabel(update), comment },
      { conversationId: context.conversationId, turnId: context.turnId },
      (payload) => (payload as { updateId?: string }).updateId === update.id,
    );
    return `Aparece-lhe um cartão no chat (${approval.id}) para instalar ${updateLabel(update)}: só passa a Ready to update quando ele carrega em Aprovar (ou diz que sim numa mensagem nova). Diz-lho numa frase.`;
  };

  return [
    {
      name: 'updates_list',
      description:
        'As atualizações das apps ligadas e do Proxmox VE dos servidores (o host): a versão de → para, o estado (STUDY à espera de estudo, TODO estudada e pronta, WAITING à espera de uma resposta do utilizador, LATER a rever mais tarde, IN_PROGRESS, VERIFYING instalada e por verificar, DONE, CANCELLED, FAILED), o risco e a tarefa no quadro.',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description:
              'open (omissão: STUDY, TODO, WAITING, LATER, IN_PROGRESS, VERIFYING), all, ou um estado.',
          },
        },
      },
      handler: async (input: { status?: string }) => {
        const wanted = (input.status ?? 'open').toUpperCase();
        const rows = (await context.updates.list(context.userId)).filter(
          (row) =>
            wanted === 'ALL'
              ? true
              : wanted === 'OPEN'
                ? [
                    'STUDY',
                    'TODO',
                    'WAITING',
                    'LATER',
                    'IN_PROGRESS',
                    'VERIFYING',
                  ].includes(row.status)
                : row.status === wanted,
        );
        if (!rows.length) return 'Não há atualizações com esse estado.';
        return rows
          .map(
            (row) =>
              `${row.id} · ${targetLabel(row)} ${row.fromVersion} → ${row.toVersion} · ${row.status}` +
              (row.risk ? ` · risco ${row.risk}` : '') +
              (row.boardTaskKey ? ` · ${row.boardTaskKey}` : '') +
              (row.question ? `\n  pergunta: ${row.question}` : ''),
          )
          .join('\n');
      },
    },
    {
      name: 'update_list_new',
      description:
        'As atualizações disponíveis: o MyHomeLab viu a versão nova (de uma app ou do Proxmox VE de um servidor) mas ninguém as abriu ainda — sem tarefa no quadro nem registo, e não andam sozinhas. Abre-as com update_start.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const rows = await context.updates.available(context.userId);
        if (!rows.length) return 'Não há atualizações disponíveis por abrir.';
        return rows
          .map(
            (row) =>
              `- ${updateLabel(row)} ${row.fromVersion} → ${row.toVersion} (update ${row.id}), vista a ${lisbon(row.createdAt)}`,
          )
          .join('\n');
      },
    },
    {
      name: 'update_start',
      description:
        'Abre uma atualização disponível: ganha a tarefa no quadro e o registo e passa para Espera por estudo (o estudo corre sozinho, na fila de sempre).',
      inputSchema: {
        type: 'object',
        properties: {
          update: UPDATE,
          reason: {
            type: 'string',
            description:
              'Uma frase para o registo (ex.: "agendamento diário").',
          },
        },
        required: ['update'],
      },
      handler: withUpdate(
        (update, input: { update: string; reason?: string }) =>
          context.updates.start(update, input.reason ?? ''),
      ),
    },
    {
      name: 'update_status',
      description:
        'O estado de uma atualização: o resumo, o risco, a pergunta em aberto, quando volta a ver, a checklist verificada, o snapshot, o resultado e o histórico (as respostas e decisões até agora).',
      inputSchema: {
        type: 'object',
        properties: { update: UPDATE },
        required: ['update'],
      },
      handler: withUpdate((update) => context.updates.statusForAgent(update)),
    },
    {
      name: 'update_release_notes',
      description:
        'As notas de todas as releases entre a versão instalada e a nova (do GitHub ou do Codeberg), da mais antiga para a mais recente.',
      inputSchema: {
        type: 'object',
        properties: { update: UPDATE },
        required: ['update'],
      },
      handler: withUpdate((update) => context.updates.releaseNotes(update)),
    },
    {
      name: 'update_known_issues',
      description:
        'As issues abertas no repositório da app desde que a versão nova saiu, as mais comentadas primeiro — onde aparecem os bugs de uma versão nova.',
      inputSchema: {
        type: 'object',
        properties: { update: UPDATE },
        required: ['update'],
      },
      handler: withUpdate((update) => context.updates.knownIssues(update)),
    },
    {
      name: 'update_save_study',
      description:
        'Grava o relatório de uma atualização (no registo em Documentos e na tarefa do quadro) e decide o passo seguinte (next): instalar já, recomendar ao utilizador, perguntar-lhe ou voltar a estudar daqui a N dias. Num novo estudo da mesma versão, reescreve o relatório com o que mudou.',
      inputSchema: {
        type: 'object',
        properties: {
          update: UPDATE,
          summary: {
            type: 'string',
            description:
              'Em poucas palavras, para quem não é técnico (2 a 4 frases): o que traz esta versão e o que aconselhas, como explicarias a um amigo.',
          },
          reasonsFor: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Porque atualizar, em frases simples (ex.: "Corrige uma falha de segurança no login").',
          },
          reasonsAgainst: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Porque esperar, em frases simples (ex.: "Há pessoas a dizer que a atualização falha").',
          },
          study: {
            type: 'string',
            description:
              'Os detalhes técnicos em Markdown: ## O que muda, ## Quebras e passos manuais, ## Problemas conhecidos, ## Segurança, ## Como atualizar (os comandos, se os souberes).',
          },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
          recommendation: {
            type: 'string',
            description:
              'Numa frase: atualizar já, esperar (até quando/porquê) ou só depois de responder.',
          },
          next: {
            type: 'string',
            enum: ['install', 'recommend', 'waiting', 'later'],
            description:
              'install = instalas tu, já (fica em Ready to update e o MyHomeLab pede a instalação): só quando as regras da app o deixam — risco baixo, não é major, sem passos à mão e não é o host; senão o MyHomeLab deixa-a em Waiting com a recomendação · recommend = recomendas instalar mas achas importante que a decisão seja dele (Waiting for reply com a recomendação) · waiting = precisa de uma resposta dele antes · later = voltar a estudar daqui a recheckInDays.',
          },
          question: {
            type: 'string',
            description: 'WAITING: a pergunta exata ao utilizador.',
          },
          recheckInDays: {
            type: 'number',
            description:
              'LATER: daqui a quantos dias voltas a estudar (1–90; ex.: 7 para dar tempo às correções).',
          },
          updateAfter: {
            type: 'string',
            description:
              'AAAA-MM-DD: a partir de quando aconselhas atualizar (ex.: a regra dos 3 dias depois de a versão sair). Vai para a data de fim da tarefa.',
          },
          manualSteps: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Só os passos à mão reais da instalação, que as ferramentas não fazem (ex.: mudar uma opção no app.ini depois de instalar); cada um vira uma sub-tarefa. ' +
              'Nunca: decisões dele (vão na pergunta, em question) nem leituras ou verificações (fazem-se no estudo; o que ficar por ver vai no estudo e no risco). Quase sempre vazio.',
          },
          sources: {
            type: 'array',
            description:
              'Onde foste buscar a informação (releases, issues, documentação): ficam no relatório e como links da tarefa.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
              },
              required: ['title', 'url'],
            },
          },
        },
        required: [
          'update',
          'summary',
          'study',
          'risk',
          'recommendation',
          'next',
        ],
      },
      handler: withUpdate((update, input: StudyInput & { update: string }) =>
        context.updates.saveStudy(update, input),
      ),
    },
    {
      name: 'update_set_status',
      description:
        'Muda o estado de uma atualização (install, waiting com a pergunta, later para voltar a estudar daqui a N dias, cancelled) e escreve o porquê no registo e na tarefa do quadro. Usa-o quando o utilizador responde (ex.: "vê daqui a uma semana" → later com 7). install é instalar: no chat aparece-lhe um cartão e só passa a Ready to update quando ele aprova; num disparo é recusado (aí ele aprova na tarefa).',
      inputSchema: {
        type: 'object',
        properties: {
          update: UPDATE,
          status: {
            type: 'string',
            enum: ['install', 'waiting', 'later', 'cancelled'],
          },
          comment: {
            type: 'string',
            description:
              'O porquê (ou a pergunta, em waiting), incluindo o que o utilizador respondeu.',
          },
          recheckInDays: {
            type: 'number',
            description: 'later: daqui a quantos dias (1–90).',
          },
        },
        required: ['update', 'status', 'comment'],
      },
      handler: withUpdate(
        (
          update,
          input: {
            update: string;
            status: 'install' | 'todo' | 'waiting' | 'later' | 'cancelled';
            comment: string;
            recheckInDays?: number;
          },
        ) =>
          input.status === 'install' || input.status === 'todo'
            ? proposeInstall(update, input.comment)
            : context.updates.setStatus(
                update,
                input.status,
                input.comment,
                input.recheckInDays,
              ),
      ),
    },
    {
      name: 'update_add_note',
      description:
        'Escreve uma nota no registo da atualização e na tarefa do quadro (ex.: o que viste nos logs, uma resposta do utilizador). Não substitui o estudo: um estudo, mesmo incompleto, grava-se sempre com update_save_study (que muda o estado).',
      inputSchema: {
        type: 'object',
        properties: {
          update: UPDATE,
          note: { type: 'string', description: 'Markdown.' },
        },
        required: ['update', 'note'],
      },
      handler: withUpdate((update, input: { update: string; note: string }) =>
        context.updates.addNote(update, input.note),
      ),
    },
    {
      name: 'update_check',
      description:
        'Marca um ponto da tentativa em curso (o número que vem de update_prepare ou update_verify) à medida que o validas: validated, not_validated, not_applicable ou skipped, com a prova (o valor que viste). skipped só quando ele pediu diretamente para passar por cima dessa regra (ex.: atualizar agora, fora do horário) — a prova diz o pedido. Ele vê a tentativa a encher em direto. Não decide nada: o que fazer com um ponto não validado está nas regras.',
      inputSchema: {
        type: 'object',
        properties: {
          update: UPDATE,
          point: { type: 'integer', description: 'O número do ponto.' },
          state: {
            type: 'string',
            enum: ['validated', 'not_validated', 'not_applicable', 'skipped'],
          },
          evidence: {
            type: 'string',
            description:
              'A prova: o valor que viste (ex.: "backup de hoje às 03:00, 1,2 GB"), ou porque não se aplica.',
          },
        },
        required: ['update', 'point', 'state', 'evidence'],
      },
      handler: withUpdate(
        (
          update,
          input: {
            update: string;
            point: number;
            state: 'validated' | 'not_validated' | 'not_applicable' | 'skipped';
            evidence: string;
          },
        ) => context.updates.check(update, input, agentKey),
      ),
    },
    {
      name: 'update_attempt_close',
      description:
        'Fecha a tentativa em curso quando não avanças (um ponto não validado que não resolves agora): fica guardada como falhada, com o porquê e o que faltou, e vai para o registo. A próxima update_prepare abre uma tentativa nova.',
      inputSchema: {
        type: 'object',
        properties: {
          update: UPDATE,
          reason: {
            type: 'string',
            description:
              'Porque paras, curto (ex.: "não há snapshot da VM 101; o backup falhou").',
          },
        },
        required: ['update', 'reason'],
      },
      handler: withUpdate((update, input: { update: string; reason: string }) =>
        context.updates.closeAttempt(update, input.reason),
      ),
    },
    {
      name: 'update_verify',
      description:
        'Depois de instalada (VERIFYING): o "feito quando" da especificação. 1.ª chamada (sem checklist): os pontos da tentativa (os do "depois") e os documentos; marca-os com update_check. 2.ª (checklist: [] se já marcaste tudo, ou com a prova de cada ponto): grava no registo; done: true fica feita (Done), done: false fica em Verifying com a nota do problema.',
      inputSchema: {
        type: 'object',
        properties: {
          update: UPDATE,
          checklist: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                point: { type: 'string' },
                ok: { type: 'boolean' },
                evidence: { type: 'string' },
              },
              required: ['point', 'ok', 'evidence'],
            },
          },
          done: {
            type: 'boolean',
            description: 'true se ficou tudo bem.',
          },
          note: {
            type: 'string',
            description: 'O problema, se houver, e o que propões.',
          },
        },
        required: ['update'],
      },
      handler: withUpdate(
        (
          update,
          input: {
            update: string;
            checklist?: { point: string; ok: boolean; evidence: string }[];
            done?: boolean;
            note?: string;
          },
        ) => context.updates.verify(update, input),
      ),
    },
    {
      name: 'update_prepare',
      description:
        'Prepara a atualização de uma app. 1.ª chamada (sem checklist): abre a tentativa (os pontos das regras numerados, as medições do MyHomeLab — factos, não bloqueiam nada) e dá os documentos obrigatórios; marca cada ponto com update_check à medida que o validas. 2.ª chamada (checklist: [] se já marcaste tudo, ou a checklist com a prova de cada ponto): escreve a especificação no registo (objetivo, comandos, feito quando, volta atrás, riscos, as regras usadas). O código não decide: o que fazer com um ponto que falha e a aprovação do utilizador estão nas regras. Depois corres com update_run (apps no servidor) ou, nas peças do Home Assistant, ha_call_service update.install com backup (tu, se o tens, ou o agente da equipa que o tem).',
      inputSchema: {
        type: 'object',
        properties: {
          update: UPDATE,
          server: {
            type: 'string',
            description: 'O servidor Proxmox (nome). Omite quando só há um.',
          },
          guest: {
            type: 'string',
            description:
              'O CT ou VM onde a app corre: o vmid (ex.: "105") ou o nome. Não se usa nas peças do Home Assistant nem no Proxmox VE (o host: os comandos correm no próprio servidor).',
          },
          commands: {
            type: 'array',
            items: { type: 'string' },
            description:
              "Os comandos, por ordem, tal como correm no servidor Proxmox (ex.: pct exec 105 -- bash -lc 'cd /opt/app && docker compose pull && docker compose up -d'). Vêm do documento de regras da app.",
          },
          checklist: {
            type: 'array',
            description:
              '2.ª chamada: um item por ponto devolvido na 1.ª, com a prova.',
            items: {
              type: 'object',
              properties: {
                point: { type: 'string' },
                ok: { type: 'boolean' },
                evidence: {
                  type: 'string',
                  description:
                    'O valor que viste (ex.: "12 GB livres, df -h no CT 105").',
                },
              },
              required: ['point', 'ok', 'evidence'],
            },
          },
        },
        required: ['update'],
      },
      handler: withUpdate(
        (
          update,
          input: {
            update: string;
            server?: string;
            guest?: string;
            commands?: string[];
            checklist?: { point: string; ok: boolean; evidence: string }[];
          },
        ) => context.updates.prepare(update, input),
      ),
    },
    {
      name: 'update_run',
      description:
        'Corre uma atualização preparada de uma app no servidor (em segundo plano): o snapshot do CT/VM, os comandos da especificação, a confirmação da versão nova e, se falhar, a volta ao snapshot; no fim fica em VERIFYING. No Proxmox VE (o host) não há snapshot: se falhar, fica em FAILED sem volta atrás. Não pergunta nada: quem decide se pode correr são as regras (estar em Ready to update é a aprovação, ou um pedido direto dele).',
      inputSchema: {
        type: 'object',
        properties: {
          update: UPDATE,
          snapshot: {
            type: 'boolean',
            description:
              'Omissão: true. false só se as regras o permitirem (sem snapshot não há volta atrás automática).',
          },
        },
        required: ['update'],
      },
      handler: withUpdate(
        (update, input: { update: string; snapshot?: boolean }) =>
          context.updates.run(update, input, {
            agentKey,
            turnId: context.turnId,
          }),
      ),
    },
  ];
}
