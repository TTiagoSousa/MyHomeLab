import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AiCredentialService } from 'src/ai-credential/ai-credential.service';
import { AiUsageService } from 'src/ai-credential/ai-usage.service';
import { NotificationService } from 'src/notification/notification.service';
import { runAgent, SUBAGENT_MODEL } from 'src/assistant/claude-agent.client';
import {
  DocKind,
  NotificationKind,
  Prisma,
} from 'src/generated/prisma/client/client';
import { DocsService } from './docs.service';

/** Espera-se este tempo depois da última mudança antes de verificar (várias mudanças seguidas = uma verificação). */
const DEBOUNCE_MS = 60_000;
const RULE_KINDS: DocKind[] = [DocKind.RULES, DocKind.CHECKLIST];

export interface DocConflict {
  docId: string;
  title: string;
  text: string;
}

const PROMPT =
  'Comparas regras de um home lab, escritas pelo utilizador em português europeu. Recebes um DOCUMENTO e OUTROS documentos que valem ao mesmo tempo. ' +
  'Encontra só contradições reais: duas regras que não se podem cumprir as duas ao mesmo tempo (ex.: "só atualizar das 9h às 22h" e "só atualizar das 5h às 6h" sem nenhuma dizer qual ganha). ' +
  'Não contes diferenças de pormenor, regras complementares, nem casos em que um documento já diz que substitui o outro. ' +
  'Responde só com JSON, sem mais nada: [{"docId": "<id do outro documento>", "text": "<a contradição numa frase>"}] ou [] se não houver.';

/**
 * O verificador de regras em conflito: quando uma regra obrigatória muda, um modelo
 * compara-a com as outras que valem ao mesmo tempo (as gerais e as ligadas ao mesmo)
 * e guarda as contradições no documento, com uma notificação. Não muda nada.
 */
@Injectable()
export class DocConflictsService implements OnModuleInit {
  private readonly logger = new Logger(DocConflictsService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly docs: DocsService,
    private readonly ai: AiCredentialService,
    private readonly usage: AiUsageService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit() {
    this.docs.onChange((userId, doc) => {
      if (!doc.required || !RULE_KINDS.includes(doc.kind)) {
        return Promise.resolve();
      }
      clearTimeout(this.timers.get(doc.id));
      this.timers.set(
        doc.id,
        setTimeout(() => {
          this.timers.delete(doc.id);
          void this.check(userId, doc.id).catch((error: unknown) =>
            this.logger.warn(
              `Regras em conflito (${doc.id}): ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
        }, DEBOUNCE_MS),
      );
      return Promise.resolve();
    });
  }

  /** Compara o documento com os que valem ao mesmo tempo e guarda o que se contradiz. */
  async check(userId: string, docId: string): Promise<DocConflict[]> {
    const doc = await this.prisma.doc.findFirst({
      where: { id: docId, userId },
      include: { links: true },
    });
    if (!doc) throw new NotFoundException('Este documento já não existe.');
    const targets = doc.links.map((link) => ({
      type: link.type,
      targetId: link.targetId,
    }));
    const others = await this.prisma.doc.findMany({
      where: {
        userId,
        id: { not: doc.id },
        required: true,
        kind: { in: RULE_KINDS },
        OR: [
          { links: { none: {} } },
          ...(targets.length ? [{ links: { some: { OR: targets } } }] : []),
        ],
      },
      select: { id: true, title: true, content: true },
    });
    if (!others.length) return this.save(userId, doc.id, []);
    // Sem chave de IA não se compara: fica o que estava guardado.
    const client = await this.ai.getClient(userId);
    if (!client)
      return (doc.conflicts as unknown as DocConflict[] | null) ?? [];
    const request =
      `DOCUMENTO "${doc.title}" (${doc.id}):\n${doc.content}\n\n` +
      others
        .map(
          (other) => `OUTRO "${other.title}" (${other.id}):\n${other.content}`,
        )
        .join('\n\n');
    const result = await runAgent(
      client,
      PROMPT,
      [],
      [{ role: 'user', content: request }],
      {
        model: SUBAGENT_MODEL,
        effort: 'low',
        onUsage: (used) =>
          void this.usage.record(userId, 'verificador', 'check', used),
      },
    );
    const conflicts = parseConflicts(result.replyText, others);
    await this.save(userId, doc.id, conflicts);
    if (conflicts.length) {
      await this.notifications
        .openUserSubject({
          userId,
          subject: `doc-conflicts:${doc.id}`,
          kind: NotificationKind.AGENT_NOTICE,
          title: `Regras em conflito em "${doc.title}"`,
          message: conflicts
            .map((item) => `Com "${item.title}": ${item.text}`)
            .join('\n'),
        })
        .catch(() => undefined);
    }
    return conflicts;
  }

  private async save(userId: string, docId: string, conflicts: DocConflict[]) {
    // Sem conflitos, o aviso que houver deixa de fazer sentido.
    if (!conflicts.length) {
      await this.notifications
        .resolveUserSubject(
          userId,
          `doc-conflicts:${docId}`,
          NotificationKind.AGENT_NOTICE,
        )
        .catch(() => undefined);
    }
    await this.prisma.doc.update({
      where: { id: docId },
      data: {
        conflicts: conflicts.length
          ? (conflicts as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        conflictsCheckedAt: new Date(),
      },
    });
    return conflicts;
  }
}

function parseConflicts(
  text: string,
  others: { id: string; title: string }[],
): DocConflict[] {
  const json = /\[[\s\S]*\]/.exec(text)?.[0];
  if (!json) return [];
  try {
    const items = JSON.parse(json) as { docId?: string; text?: string }[];
    return items
      .map((item) => {
        const other = others.find((doc) => doc.id === item.docId);
        return other && item.text
          ? {
              docId: other.id,
              title: other.title,
              text: item.text.slice(0, 500),
            }
          : null;
      })
      .filter((item): item is DocConflict => item !== null)
      .slice(0, 10);
  } catch {
    return [];
  }
}
