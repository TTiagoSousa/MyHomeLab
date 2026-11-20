import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChatFile } from 'src/generated/prisma/client/client';
import {
  FileContent,
  INLINE_TEXT_CHARS,
  KIND_LABEL,
  cutText,
  describeTables,
  imageType,
  isLegacyOffice,
  kindOf,
  readContent,
} from './helpers/fileContent';

export const MAX_CHAT_FILES = 5;
export const MAX_CHAT_FILE_BYTES = 20 * 1024 * 1024;
/** O que vai inteiro à IA numa mensagem (PDF e imagens), somado: o pedido tem um teto. */
const MAX_INLINE_BYTES = 24 * 1024 * 1024;
/** A IA vê imagens até 5 MB e PDFs até 100 páginas de uma vez. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_PAGES = 100;

export interface UploadedChatFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export type ChatFileInfo = Pick<
  ChatFile,
  'id' | 'name' | 'mimeType' | 'size' | 'createdAt'
>;

const INFO = {
  id: true,
  name: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const;

export const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Uma linha para o modelo: o nome, o id, o tipo e o tamanho. */
export const fileLine = (file: ChatFileInfo) =>
  `«${file.name}» (id ${file.id}, ${KIND_LABEL[kindOf(file.name, file.mimeType) ?? 'text']}, ${fileSize(file.size)})`;

/**
 * Os ficheiros que ele manda no chat: guardam-se com a conversa, leem-se no código
 * (Word, Excel, CSV, texto) ou vão inteiros à IA (PDF, imagens), e os agentes voltam
 * a eles pelas ferramentas chat_file_*.
 */
@Injectable()
export class ChatFileService {
  /** O conteúdo lido dos últimos ficheiros: um Excel grande não se volta a ler a cada ferramenta. */
  private readonly parsed = new Map<string, FileContent>();

  constructor(private readonly prisma: PrismaService) {}

  /** Recusa antes de gravar a pergunta: demasiados, grandes demais ou num formato que não se lê. */
  validate(files: UploadedChatFile[]): void {
    if (files.length > MAX_CHAT_FILES) {
      throw new BadRequestException(
        `Podes mandar até ${MAX_CHAT_FILES} ficheiros de cada vez.`,
      );
    }
    for (const file of files) {
      const name = this.nameOf(file);
      if (file.size > MAX_CHAT_FILE_BYTES) {
        throw new BadRequestException(
          `«${name}» tem ${fileSize(file.size)}; o máximo é ${fileSize(MAX_CHAT_FILE_BYTES)}.`,
        );
      }
      if (isLegacyOffice(name)) {
        throw new BadRequestException(
          `«${name}» está num formato antigo do Office. Guarda-o como .docx ou .xlsx e manda outra vez.`,
        );
      }
      if (!kindOf(name, file.mimetype)) {
        throw new BadRequestException(
          `Não sei ler «${name}». Aceito PDF, Word (.docx), Excel (.xlsx), CSV, texto e imagens.`,
        );
      }
    }
  }

  /** O nome como o browser o mandou (o multer lê-o em latin1). */
  private nameOf(file: UploadedChatFile) {
    return Buffer.from(file.originalname, 'latin1')
      .toString('utf8')
      .replace(/[\\/]/g, '_')
      .slice(0, 200);
  }

  async save(
    userId: string,
    conversationId: string,
    messageId: string,
    files: UploadedChatFile[],
  ): Promise<ChatFile[]> {
    const saved: ChatFile[] = [];
    for (const file of files) {
      saved.push(
        await this.prisma.chatFile.create({
          data: {
            userId,
            conversationId,
            messageId,
            name: this.nameOf(file),
            mimeType: file.mimetype || 'application/octet-stream',
            size: file.size,
            sha256: createHash('sha256').update(file.buffer).digest('hex'),
            data: new Uint8Array(file.buffer),
          },
        }),
      );
    }
    return saved;
  }

  /** Os ficheiros de uma conversa (sem ela, os últimos que ele mandou). */
  list(userId: string, conversationId?: string): Promise<ChatFileInfo[]> {
    return this.prisma.chatFile.findMany({
      where: { userId, ...(conversationId ? { conversationId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: conversationId ? 100 : 20,
      select: INFO,
    });
  }

  async get(userId: string, id: string): Promise<ChatFile> {
    const file = await this.prisma.chatFile.findFirst({
      where: { id, userId },
    });
    if (!file) throw new NotFoundException('Este ficheiro já não existe.');
    return file;
  }

  /** O conteúdo lido de um ficheiro (Word e texto em Markdown, Excel e CSV em tabelas). */
  content(file: ChatFile): FileContent {
    const cached = this.parsed.get(file.id);
    if (cached) return cached;
    const content = readContent(
      file.name,
      file.mimeType,
      Buffer.from(file.data),
    );
    this.parsed.set(file.id, content);
    if (this.parsed.size > 20) {
      this.parsed.delete([...this.parsed.keys()][0]);
    }
    return content;
  }

  /**
   * A mensagem dele com os ficheiros, para o modelo: primeiro os ficheiros (o PDF e as
   * imagens inteiros, o Word e as folhas lidos), no fim o que ele escreveu.
   */
  turnContent(files: ChatFile[], message: string): ContentBlockParam[] {
    const blocks: ContentBlockParam[] = [
      {
        type: 'text',
        text:
          `Ficheiros que ele mandou com esta mensagem (${files.length}):\n` +
          files.map((file) => `- ${fileLine(file)}`).join('\n'),
      },
    ];
    let inlineBytes = 0;
    for (const file of files) {
      const data = Buffer.from(file.data);
      let content: FileContent;
      try {
        content = this.content(file);
      } catch (error) {
        blocks.push({
          type: 'text',
          text: `Não consegui abrir «${file.name}»: ${error instanceof Error ? error.message : String(error)}.`,
        });
        continue;
      }
      if (content.kind === 'pdf' || content.kind === 'image') {
        const tooBig =
          inlineBytes + data.length > MAX_INLINE_BYTES ||
          (content.kind === 'image' && data.length > MAX_IMAGE_BYTES) ||
          (content.kind === 'pdf' && (content.pages ?? 0) > MAX_PDF_PAGES);
        if (tooBig) {
          blocks.push({
            type: 'text',
            text: `«${file.name}» (id ${file.id}) é grande demais para ir inteiro nesta mensagem${content.pages ? ` (${content.pages} páginas)` : ''}. Para o analisar, usa chat_file_ask com perguntas concretas.`,
          });
          continue;
        }
        inlineBytes += data.length;
        blocks.push(
          content.kind === 'pdf'
            ? {
                type: 'document',
                title: file.name,
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: data.toString('base64'),
                },
              }
            : {
                type: 'text',
                text: `Imagem «${file.name}» (id ${file.id}):`,
              },
        );
        if (content.kind === 'image') {
          blocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageType(file.name, file.mimeType),
              data: data.toString('base64'),
            },
          });
        }
        continue;
      }
      blocks.push({
        type: 'text',
        text:
          `## Ficheiro «${file.name}» (id ${file.id}, ${KIND_LABEL[content.kind]})\n\n` +
          (content.tables
            ? describeTables(content.tables)
            : cutText(content.text ?? '', 0, INLINE_TEXT_CHARS) ||
              '(sem texto)'),
      });
    }
    blocks.push({
      type: 'text',
      text: message.trim() || 'Analisa os ficheiros que mandei.',
    });
    return blocks;
  }
}
