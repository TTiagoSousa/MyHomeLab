import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailRuleWithLabelPaths } from '../repositories/email-rule-repository';

/** A etiqueta que marca o documento gerado (o título pode ser mudado por ele). */
export const EMAIL_RULES_DOC_TAG = 'regras-gmail-auto';
const TITLE = 'Emails – as regras do Gmail';

const days = (count: number) => (count === 1 ? '1 dia' : `${count} dias`);

const list = (values: string[]) =>
  values.map((value) => `"${value}"`).join(', ');

/** As condições de uma regra numa frase ("De contém … e o assunto contém …"). */
function conditionsOf(rule: EmailRuleWithLabelPaths): string {
  const how =
    rule.matchType === 'EXACT'
      ? 'é exatamente'
      : rule.matchType === 'REGEX'
        ? 'bate com a expressão'
        : 'contém';
  const parts = [
    rule.fromContains.length
      ? `o remetente ${how} ${list(rule.fromContains)}`
      : null,
    rule.subjectContains.length
      ? `o assunto ${how} ${list(rule.subjectContains)}`
      : null,
    rule.keywords.length ? `o texto ${how} ${list(rule.keywords)}` : null,
    rule.excludeKeywords.length
      ? `o texto não tem ${list(rule.excludeKeywords)}`
      : null,
    rule.hasAttachment === true
      ? 'tem anexo'
      : rule.hasAttachment === false
        ? 'não tem anexo'
        : null,
    rule.mailKind === 'BULK'
      ? 'é envio em massa (newsletters, publicidade)'
      : rule.mailKind === 'DIRECT'
        ? 'é um envio direto (faturas, avisos)'
        : null,
  ].filter(Boolean);
  if (!parts.length) return 'todos os emails';
  return parts.join(rule.conditionLogic === 'ANY' ? ' **ou** ' : ' **e** ');
}

/** O que a regra faz, por ordem. */
function actionsOf(rule: EmailRuleWithLabelPaths): string[] {
  const actions: string[] = [];
  for (const path of rule.labelPaths) {
    actions.push(
      `etiqueta \`${path.path}\`${path.labelMode === 'LEAF_ONLY' ? ' (só a última)' : ''}`,
    );
  }
  if (rule.markAsRead) actions.push('marca como lido');
  if (rule.markAsImportant)
    actions.push(
      `marca como importante${rule.importantExpiresAfterDays ? ` (deixa de ser ao fim de ${days(rule.importantExpiresAfterDays)})` : ''}${rule.importantExpiresOnStar ? ' (deixa de ser quando se lhe põe estrela)' : ''}`,
    );
  if (rule.markAsStarred)
    actions.push(
      `põe estrela${rule.starredExpiresAfterDays ? ` (tira ao fim de ${days(rule.starredExpiresAfterDays)})` : ''}`,
    );
  if (rule.removeFromInbox)
    actions.push(
      `tira da caixa de entrada${rule.removeFromInboxAfterDays ? ` ao fim de ${days(rule.removeFromInboxAfterDays)}` : ''}${rule.removeOnlyIfRead ? ', só se estiver lido' : ''}${rule.markAsReadOnRemove ? ', e marca como lido' : ''}; a conversa sai inteira se o que lá resta são só respostas tuas`,
    );
  if (rule.stopProcessing)
    actions.push('**pára aqui** (as regras abaixo não correm)');
  return actions;
}

/** O documento inteiro: as contas e, em cada uma, as regras pela ordem em que correm. */
export function emailRulesContent(
  accounts: { email: string; rules: EmailRuleWithLabelPaths[] }[],
  at: Date,
): string {
  const when = at.toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });
  const sections = accounts.map(({ email, rules }) => {
    if (!rules.length) return `## ${email}\n\nSem regras.`;
    const lines = rules.map((rule, index) => {
      const actions = actionsOf(rule);
      return [
        `### ${index + 1}. ${rule.name}${rule.isActive ? '' : ' _(desligada)_'}`,
        `- **Quando:** ${conditionsOf(rule)}`,
        `- **Faz:** ${actions.length ? actions.join(' · ') : 'nada (só serve para parar as de baixo)'}`,
      ].join('\n');
    });
    return `## ${email}\n\n${lines.join('\n\n')}`;
  });
  return [
    `# ${TITLE}`,
    `> **Gerado sozinho** pelo MyHomeLab a partir das regras de Apps ligadas → Gmail → Regras (atualizado a ${when}). Não se edita aqui: muda-se a regra na página do Gmail (ou pede-se ao agente) e este documento acompanha. As preferências e o porquê das regras ficam em "Emails – regras".`,
    'As regras correm de cima para baixo, em cada conta.',
    ...sections,
  ].join('\n\n');
}

const pending = new Map<string, NodeJS.Timeout>();

/**
 * Volta a escrever o documento das regras do Gmail do dono desta conta. Muitas
 * mudanças seguidas (reordenar, uma proposta aprovada) dão uma só escrita: espera
 * 2 segundos. Nunca falha quem mudou a regra.
 */
export function scheduleEmailRulesDoc(
  prisma: PrismaService,
  accountId: string,
) {
  void prisma.connectedAccount
    .findUnique({ where: { id: accountId }, select: { userId: true } })
    .then((account) => {
      if (!account) return;
      clearTimeout(pending.get(account.userId));
      pending.set(
        account.userId,
        setTimeout(() => {
          pending.delete(account.userId);
          void writeEmailRulesDoc(prisma, account.userId).catch(
            () => undefined,
          );
        }, 2000),
      );
    })
    .catch(() => undefined);
}

/** Escreve (ou cria) o documento, guardando a versão anterior como os outros. */
export async function writeEmailRulesDoc(
  prisma: PrismaService,
  userId: string,
) {
  const accounts = await prisma.connectedAccount.findMany({
    where: { userId, emailRules: { some: {} } },
    orderBy: { createdAt: 'asc' },
    select: {
      emailAddress: true,
      emailRules: {
        orderBy: { order: 'asc' },
        include: { labelPaths: { orderBy: { order: 'asc' } } },
      },
    },
  });
  const content = emailRulesContent(
    accounts.map((account) => ({
      email: account.emailAddress ?? 'Conta sem email',
      rules: account.emailRules,
    })),
    new Date(),
  );
  const existing = await prisma.doc.findFirst({
    where: { userId, tags: { has: EMAIL_RULES_DOC_TAG } },
  });
  if (existing) {
    await prisma.$transaction([
      prisma.docVersion.create({
        data: {
          docId: existing.id,
          title: existing.title,
          content: existing.content,
          editedBy: existing.updatedBy ?? 'user',
        },
      }),
      prisma.doc.update({
        where: { id: existing.id },
        data: { content, updatedBy: 'MyHomeLab' },
      }),
    ]);
    return existing.id;
  }
  const admin = await prisma.agent.findFirst({
    where: { userId, tools: { has: 'list_email_rules' } },
    orderBy: { position: 'asc' },
  });
  const id = randomUUID();
  await prisma.doc.create({
    data: {
      id,
      userId,
      title: TITLE,
      content,
      summary:
        'As regras do Gmail de cada conta, pela ordem em que correm: quando se aplicam e o que fazem. Gerado sozinho a partir das regras.',
      tags: ['email', 'regras', EMAIL_RULES_DOC_TAG],
      // Grande (centenas de regras): não entra em todos os pedidos; o agente
      // abre-o quando precisa (docs_search), e as regras vê-as com list_email_rules.
      owner: 'USER',
      kind: 'RULES',
      updatedBy: 'MyHomeLab',
      links: admin
        ? {
            create: [{ type: 'AGENT', targetId: admin.key, label: admin.name }],
          }
        : undefined,
    },
  });
  return id;
}
