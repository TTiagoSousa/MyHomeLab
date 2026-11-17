import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { createPaperlessClient } from 'src/paperless/paperless.client';
import { BackupFile } from './backupSources';

/** O que entra: a arrumação toda (o que a API deixa ler), sem os documentos. */
const PARTS: [string, string][] = [
  ['tags', '/tags/'],
  ['correspondents', '/correspondents/'],
  ['document_types', '/document_types/'],
  ['storage_paths', '/storage_paths/'],
  ['custom_fields', '/custom_fields/'],
  ['saved_views', '/saved_views/'],
  ['workflows', '/workflows/'],
  ['mail_rules', '/mail_rules/'],
  ['mail_accounts', '/mail_accounts/'],
];

/**
 * O backup do Paperless: um JSON com a arrumação (etiquetas, correspondentes, tipos,
 * caminhos, campos, vistas guardadas, fluxos, regras e contas do correio — as palavras-
 * passe vêm escondidas pelo próprio Paperless) e a configuração da aplicação. Os
 * documentos (PDFs e a base de dados) não entram: esses guardam-se no servidor com o
 * document_exporter do Paperless.
 */
export async function paperlessBackup(
  account: ConnectedAccount,
): Promise<BackupFile> {
  if (!account.baseUrl || !account.accessToken) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O Paperless já não tem token. Liga-o outra vez em Apps ligadas.',
    );
  }
  const client = createPaperlessClient(account.baseUrl, account.accessToken);
  const { version } = await client.me();
  const missing: string[] = [];
  const data: Record<string, unknown> = {};
  for (const [name, path] of PARTS) {
    try {
      data[name] = await client.list(path);
    } catch {
      missing.push(name);
    }
  }
  try {
    data.config = await client.config();
  } catch {
    missing.push('config');
  }
  const content = Buffer.from(
    JSON.stringify(
      {
        app: 'paperless-ngx',
        version,
        createdAt: new Date().toISOString(),
        ...data,
      },
      null,
      2,
    ),
  );
  return { content, sizeBytes: content.length, missing };
}
