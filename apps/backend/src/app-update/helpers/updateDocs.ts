import {
  DocLinkType,
  ServerConnection,
} from 'src/generated/prisma/client/client';
import { DocsService, guestTargetId } from 'src/docs/docs.service';
import { normalizeText } from 'src/docs/helpers/docText';
import { UpdateWithAccount } from '../app-update.types';

/**
 * As regras do próprio servidor sobre o atualizar ou o guia dele ("Proxmox – instalar uma atualização",
 * "Guia do servidor – como se escreve") são do host: numa app, as caixas delas
 * misturavam-se com as da app. Ficam de fora, a não ser que também estejam ligadas à app.
 */
const isServerOnlyProcess = (
  doc: { tags: string[]; links: { type: DocLinkType; targetId: string }[] },
  accountId: string,
) =>
  !doc.links.some(
    (link) =>
      (link.type === DocLinkType.APP && link.targetId === accountId) ||
      link.type === DocLinkType.GUEST,
  ) &&
  doc.tags.some((tag) =>
    ['atualizacao', 'estudo', 'instalacao', 'guia'].includes(
      normalizeText(tag),
    ),
  );

/** Os documentos obrigatórios de uma atualização: os gerais e os ligados à app, à máquina ou ao servidor. */
export async function updateDocs(
  docs: DocsService,
  update: UpdateWithAccount,
  server: ServerConnection | null,
  vmid: number | null,
) {
  if (update.component) {
    // As peças (add-ons, HACS, firmware…) seguem os documentos da app marcados
    // como "peças"; as regras do servidor (snapshot, CT, disco) não se aplicam.
    const [general, linked] = await Promise.all([
      docs.requiredGeneral(update.userId),
      docs.linkedToAny(
        update.userId,
        [{ type: DocLinkType.APP, targetId: update.accountId ?? '' }],
        true,
      ),
    ]);
    return [
      ...general,
      ...linked.filter((doc) =>
        doc.tags.some((tag) => normalizeText(tag) === 'pecas'),
      ),
    ];
  }
  if (!update.accountId) {
    // O host (Proxmox VE): as regras do servidor marcadas como "atualização"
    // ("Proxmox – estudar uma atualização" e "Proxmox – instalar uma atualização"); as outras do servidor (estudar,
    // guias) não são para atualizar.
    const [general, linked] = await Promise.all([
      docs.requiredGeneral(update.userId),
      server
        ? docs.linkedToAny(
            update.userId,
            [{ type: DocLinkType.SERVER, targetId: server.id }],
            true,
          )
        : Promise.resolve([]),
    ]);
    return [
      ...general,
      ...linked.filter((doc) =>
        doc.tags.some((tag) => normalizeText(tag) === 'atualizacao'),
      ),
    ];
  }
  const [general, linked] = await Promise.all([
    docs.requiredGeneral(update.userId),
    docs.linkedToAny(
      update.userId,
      [
        { type: DocLinkType.APP, targetId: update.accountId },
        {
          type: DocLinkType.AGENT,
          targetId: await docs.updatesAgentKey(update.userId),
        },
        ...(server
          ? [
              { type: DocLinkType.SERVER, targetId: server.id },
              ...(vmid !== null
                ? [
                    {
                      type: DocLinkType.GUEST,
                      targetId: guestTargetId(server.id, vmid),
                    },
                  ]
                : []),
            ]
          : []),
      ],
      true,
    ),
  ]);
  const accountId = update.accountId;
  const seen = new Set<string>();
  return [
    ...general,
    ...linked.filter((doc) => !isServerOnlyProcess(doc, accountId)),
  ].filter((doc) => !seen.has(doc.id) && seen.add(doc.id));
}
