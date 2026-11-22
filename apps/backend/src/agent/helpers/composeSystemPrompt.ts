import { Agent } from 'src/generated/prisma/client/client';
import { templatePrompt } from '../agent-templates';
import { EXTERNAL_DATA_RULE } from './externalData';

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

  sections.push(EXTERNAL_DATA_RULE);

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

/** O índice dos documentos (DocsService.agentContext). */
export interface AgentDocs {
  index: string[];
}

/**
 * Os documentos do utilizador nas instruções: como se usam, a ordem de força e o
 * índice. A lista dos que o pedido toca vai no fim do pedido (team-agent), e o
 * agente lê-os com docs_read antes de mexer.
 */
export function docsSection(docs: AgentDocs): string {
  const index = docs.index.length
    ? `Índice ([tipo] título (id) → a que está ligado #etiquetas — resumo):\n${docs.index.join('\n')}`
    : 'Ainda não há documentos.';
  return (
    'OS DOCUMENTOS DO UTILIZADOR\n' +
    'Em Documentos há três tipos: as Regras (o que se pode fazer e como se faz — são do ' +
    'utilizador e tu segues), o Mapa de cada servidor ou app (o que lá existe — mantido pelos ' +
    'agentes) e os Registos (o que se fez — escritos pelos agentes). Os documentos mandam: ' +
    'as tuas instruções dizem quem és, os documentos dizem como se faz. Por ordem de força: as ' +
    'regras do utilizador > as tuas instruções. Entre dois ' +
    'documentos ganha o mais específico (o de uma app ao geral); se se contradizem, diz-lho.\n' +
    '- Sê meticuloso com os documentos: antes de mexer numa coisa (servidor, máquina, app, email), lê ' +
    'com docs_read todos os que lhe tocam — os da lista no fim do pedido e os do índice cujo título, ' +
    'etiquetas ou ligações digam respeito ao que vais fazer (as regras gerais incluídas). Na dúvida, lê. ' +
    'As ferramentas que mudam coisas recusam enquanto faltar ler algum da lista.\n' +
    '- Nos documentos do utilizador não escreves: propões com docs_propose uma versão nova e ele ' +
    'aprova (a anterior fica guardada). Quando descobrires algo que vale para a próxima vez, ' +
    'propõe-o no documento da app ou do servidor, na secção certa; não cries documentos novos para isso.\n' +
    '- Uma regra que não consegues cumprir ou verificar: paras e perguntas.\n' +
    '- O código do MyHomeLab só trava o essencial (sem ele a ver: enviar, mudar a equipa, apagar); o resto é contigo, a cumprir as regras.\n' +
    '- Quando verificas as regras para fazer algo (estudar, preparar ou verificar uma atualização), fica uma tentativa com cada ponto validado ou não e a prova.\n\n' +
    index
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
