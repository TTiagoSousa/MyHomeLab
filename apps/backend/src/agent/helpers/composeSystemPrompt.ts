import { Agent } from 'src/generated/prisma/client/client';
import { templatePrompt } from '../agent-templates';

/** O nome da ferramenta com que um chefe pede trabalho a alguém da equipa. */
export const delegationToolName = (agentKey: string) => `ask_${agentKey}`;

/**
 * As instruções completas de um agente: as dele (ou as do site), as extra que o
 * utilizador escreveu e, no fim, quem é a equipa dele e a quem responde — tirado da
 * configuração, para um agente novo ou uma mudança de chefe valerem logo.
 *
 * Só muda quando a equipa muda, por isso não estraga a cache entre conversas.
 */
export function composeAgentPrompt(
  agent: Agent,
  team: Agent[],
  docs: AgentDocs | null = null,
): string {
  const sections = [
    appendCustomPrompt(
      agent.prompt ?? templatePrompt(agent.template) ?? '',
      agent.extraPrompt,
    ),
  ];

  const members = team.filter(
    (member) => member.reportsToId === agent.id && member.isActive,
  );
  if (members.length) {
    sections.push(
      'A TUA EQUIPA\n' +
        'Podes pedir trabalho a estes agentes, cada um pela sua ferramenta:\n' +
        members
          .map(
            (member) =>
              `${delegationToolName(member.key)}: ${member.name}. ${member.description}`,
          )
          .join('\n') +
        '\nAo pedir, passa o pedido completo, com as datas, horas, nomes e quantidades. ' +
        'Cada um devolve-te um relatório; se faltar alguma coisa, pede outra vez.',
    );
  }

  const boss = team.find((member) => member.id === agent.reportsToId);
  if (boss) {
    sections.push(
      'A QUEM RESPONDES\n' +
        `Trabalhas para ${boss.name}. Não falas com o utilizador: o que escreves é um ` +
        'relatório para quem te pediu o trabalho. Escreve-o em português europeu, curto e ' +
        'factual: o que fizeste, o que encontraste (com os números), o que falhou e, se ' +
        'faltar uma informação ou uma decisão do utilizador, a pergunta exata. Sem markdown.',
    );
  }

  if (docs) sections.push(docsSection(docs));

  return sections.join('\n\n');
}

/** O índice dos documentos e os obrigatórios gerais (DocsService.agentContext). */
export interface AgentDocs {
  index: string[];
  general: { title: string; content: string }[];
}

/**
 * Os documentos do utilizador nas instruções: como se usam, a ordem de força,
 * o índice e o texto dos obrigatórios gerais. Os obrigatórios de uma app ou de
 * uma máquina vão no fim do pedido que as menciona (team-agent).
 */
export function docsSection(docs: AgentDocs): string {
  const index = docs.index.length
    ? `Índice ([tipo · obrigatório] título (id) → a que está ligado #etiquetas — resumo):\n${docs.index.join('\n')}`
    : 'Ainda não há documentos.';
  const general = docs.general.length
    ? '\n\nOBRIGATÓRIOS (os gerais e os ligados a ti — valem sempre):\n\n' +
      docs.general
        .map((doc) => `── ${doc.title} ──\n${doc.content}`)
        .join('\n\n')
    : '';
  return (
    'OS DOCUMENTOS DO UTILIZADOR\n' +
    'Em Documentos o utilizador escreve as regras, os processos (o "como se faz"), as checklists ' +
    'e as notas que segues; os agentes escrevem lá os guias e os registos. Os documentos mandam: ' +
    'as tuas instruções dizem quem és, os documentos dizem como se faz. Por ordem de força: as ' +
    'regras do utilizador > as tuas instruções. Entre dois ' +
    'documentos ganha o mais específico (o de uma app ao geral); se se contradizem, diz-lho.\n' +
    '- Antes de mexer numa coisa (servidor, máquina, app), lê os documentos ligados a ela com ' +
    'docs_read. Os obrigatórios do que o pedido menciona já vêm no fim do pedido.\n' +
    '- Nos documentos do utilizador não escreves: propões com docs_propose uma versão nova e ele ' +
    'aprova (a anterior fica guardada). Quando descobrires algo que vale para a próxima vez, ' +
    'propõe-o no documento da app ou do servidor, na secção certa; não cries documentos novos para isso.\n' +
    '- Uma regra que não consegues cumprir ou verificar: paras e perguntas.\n' +
    '- O código do MyHomeLab não trava nada (mede, corre e regista): o travão és tu, a cumprir as regras.\n' +
    '- Quando verificas as regras para fazer algo (estudar, preparar ou verificar uma atualização), fica uma tentativa com cada ponto validado ou não e a prova.\n\n' +
    index +
    general
  );
}

/**
 * As instruções extra do utilizador vão no fim das do agente, nunca as substituem.
 * Ficam no fim de propósito: as últimas são as que o modelo trata como mais específicas.
 */
export function appendCustomPrompt(
  basePrompt: string,
  customPrompt: string | null | undefined,
): string {
  const custom = customPrompt?.trim();
  if (!custom) return basePrompt;

  return (
    `${basePrompt}\n\n` +
    `Instruções adicionais que o utilizador escreveu nas tuas definições. ` +
    `Segue-as sempre que não contrariem as regras acima:\n${custom}`
  );
}
