import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import {
  createDispatcharrClient,
  DispatcharrChannel,
  DispatcharrClient,
  DispatcharrGroup,
  DispatcharrLiveChannel,
  DispatcharrRecording,
  dispatcharrVersionInfo,
} from 'src/dispatcharr/dispatcharr.client';
import { lisbonStamp, parseLisbonDate } from 'src/utils/lisbonTime';

const fold = (text: string) => text.trim().toLowerCase();

const ACCOUNT = {
  type: 'string' as const,
  description: 'O Dispatcharr (nome ou endereço). Omite quando só há um.',
};

const when = (iso?: string | null) => lisbonStamp(iso, 'nunca');

const duration = (seconds?: number) => {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
};

/** O Dispatcharr a usar: o único, ou o que bate com o nome ou o endereço. */
export async function dispatcharrTarget(
  context: AgentContext,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await context.connectedAccountRepository.findAllByUser(
      context.userId,
      ConnectionProvider.DISPATCHARR,
    )
  ).filter(
    (account) => account.isActive && account.baseUrl && account.accessToken,
  );
  if (!accounts.length) {
    return 'Não há nenhum Dispatcharr ligado. Liga-o em Apps ligadas → Dispatcharr.';
  }
  const label = (account: ConnectedAccount) =>
    `${account.displayName ?? 'Dispatcharr'} (${account.baseUrl})`;
  const matches = wanted?.trim()
    ? accounts.filter((account) => fold(label(account)).includes(fold(wanted)))
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o Dispatcharr: ${accounts.map(label).join(', ')}.`;
  }
  return matches[0];
}

/** Um grupo pelo nome (exato, ou parte sem ambiguidade). */
export function pickGroup(
  groups: DispatcharrGroup[],
  wanted: string,
): DispatcharrGroup {
  const target = fold(wanted);
  const exact = groups.find((group) => fold(group.name) === target);
  if (exact) return exact;
  const partial = groups.filter((group) => fold(group.name).includes(target));
  if (partial.length === 1) return partial[0];
  throw new Error(
    partial.length
      ? `há vários grupos com «${wanted}»: ${partial.map((group) => group.name).join(', ')}`
      : `não há o grupo «${wanted}»`,
  );
}

const channelName = (channel: DispatcharrChannel) =>
  channel.effective_name ?? channel.name;

const channelNumber = (channel: DispatcharrChannel) =>
  channel.effective_channel_number ?? channel.channel_number;

/** Um canal pelo id, pelo número ou pelo nome (sem ambiguidade). */
async function findChannel(
  dispatcharr: DispatcharrClient,
  wanted: string | number,
): Promise<DispatcharrChannel> {
  const text = String(wanted).trim();
  if (/^\d+$/.test(text)) {
    const byId = await dispatcharr.channel(Number(text)).catch(() => null);
    if (byId) return byId;
  }
  const { items } = await dispatcharr.channels({ search: text, limit: 50 });
  const target = fold(text);
  const exact = items.filter(
    (channel) =>
      fold(channelName(channel)) === target ||
      String(channelNumber(channel)) === text,
  );
  if (exact.length === 1) return exact[0];
  if (items.length === 1) return items[0];
  throw new Error(
    items.length
      ? `há vários canais com «${text}»: ${items
          .slice(0, 15)
          .map(
            (channel) =>
              `${channelNumber(channel) ?? '-'} ${channelName(channel)} (id ${channel.id})`,
          )
          .join(', ')}`
      : `não há o canal «${text}»`,
  );
}

const liveLine = (channel: DispatcharrLiveChannel) =>
  `- ${channel.channel_name ?? channel.channel_id} — ${channel.state ?? '?'}${channel.healthy === false ? ', COM PROBLEMAS' : ''}, ${channel.client_count ?? 0} clientes, há ${duration(channel.uptime) || '?'}${channel.stream_name ? `, stream «${channel.stream_name}»` : ''}${channel.avg_bitrate ? `, ${channel.avg_bitrate}` : ''} (uuid ${channel.channel_id})${(
    channel.clients ?? []
  )
    .map(
      (client) =>
        `\n    · ${client.ip_address ?? '?'}${client.user_agent ? ` ${client.user_agent.slice(0, 60)}` : ''} (cliente ${client.client_id})`,
    )
    .join('')}`;

const recordingLine = (
  recording: DispatcharrRecording,
  names: Map<number, string>,
) =>
  `- ${when(recording.start_time)} → ${when(recording.end_time)} ${names.get(recording.channel) ?? `canal ${recording.channel}`}${recording.custom_properties?.program?.title ? ` «${recording.custom_properties.program.title}»` : ''} — ${recording.custom_properties?.status ?? (new Date(recording.end_time) < new Date() ? 'feita' : 'agendada')} (id ${recording.id})`;

export function buildDispatcharrTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(
      work: (
        dispatcharr: DispatcharrClient,
        input: T,
        account: ConnectedAccount,
      ) => Promise<string>,
    ) =>
    async (input: T & { account?: string }) => {
      const account = await dispatcharrTarget(context, input.account);
      if (typeof account === 'string') return account;
      try {
        return await work(
          createDispatcharrClient(
            account.baseUrl ?? '',
            account.accessToken ?? '',
          ),
          input,
          account,
        );
      } catch (error) {
        return `Falhou: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

  return [
    {
      name: 'dispatcharr_overview',
      description:
        'O Dispatcharr (gere as listas IPTV, os canais, o EPG e o proxy dos streams): a versão, quantos canais e streams, as contas M3U e as fontes de EPG com o estado e a última mensagem (erros), os canais a dar agora e quantos clientes, e as gravações agendadas.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (dispatcharr, _input, account) => {
        const [version, channels, streams, m3u, epg, stats, recordings] =
          await Promise.all([
            dispatcharrVersionInfo(account.baseUrl ?? ''),
            dispatcharr.channels({ limit: 1 }),
            dispatcharr.streams({ limit: 1 }),
            dispatcharr.m3uAccounts(),
            dispatcharr.epgSources(),
            dispatcharr.stats().catch(() => null),
            dispatcharr.recordings().catch((): DispatcharrRecording[] => []),
          ]);
        const live = stats?.live?.channels ?? [];
        const upcoming = recordings.filter(
          (item) => new Date(item.start_time) > new Date(),
        );
        const clients = live.reduce(
          (total, channel) => total + (channel.client_count ?? 0),
          0,
        );
        return [
          `Dispatcharr ${version.version}: ${channels.total} canais, ${streams.total} streams.`,
          `Contas M3U:\n${
            m3u
              .map(
                (item) =>
                  `- ${item.name} — ${item.account_type ?? ''} ${item.is_active === false ? 'DESLIGADA' : (item.status ?? '?')}, até ${item.max_streams || '∞'} streams, atualizada ${when(item.updated_at)}${item.last_message ? ` — ${item.last_message.slice(0, 200)}` : ''} (id ${item.id})`,
              )
              .join('\n') || '- nenhuma'
          }`,
          `Fontes de EPG:\n${
            epg
              .map(
                (item) =>
                  `- ${item.name} — ${item.source_type ?? ''} ${item.is_active === false ? 'DESLIGADA' : (item.status ?? '?')}, atualizada ${when(item.updated_at)}${item.last_message ? ` — ${item.last_message.slice(0, 200)}` : ''} (id ${item.id})`,
              )
              .join('\n') || '- nenhuma'
          }`,
          live.length
            ? `A dar agora: ${live.length} canais, ${clients} clientes${stats?.vod?.count ? `; VOD: ${stats.vod.count}` : ''}${stats?.catchup?.count ? `; catch-up: ${stats.catchup.count}` : ''}.`
            : 'Nenhum canal a dar agora.',
          upcoming.length
            ? `Gravações agendadas: ${upcoming.length} (a próxima ${when(upcoming.sort((a, b) => a.start_time.localeCompare(b.start_time))[0].start_time)}).`
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
    {
      name: 'dispatcharr_channels',
      description:
        'Os canais do Dispatcharr (número, nome, grupo, tvg-id, EPG, quantos streams). Procura por texto ou filtra por grupo. Com channel (id, número ou nome), mostra esse canal com os streams por ordem de prioridade.',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          group: { type: 'string', description: 'O nome exato do grupo.' },
          channel: { type: 'string' },
          limit: { type: 'integer', description: 'Até 500 (omissão 100).' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          dispatcharr,
          input: {
            search?: string;
            group?: string;
            channel?: string;
            limit?: number;
          },
        ) => {
          const groups = await dispatcharr
            .groups()
            .catch((): DispatcharrGroup[] => []);
          const groupName = (id?: number | null) =>
            groups.find((group) => group.id === id)?.name ?? 'sem grupo';
          if (input.channel?.trim()) {
            const channel = await findChannel(dispatcharr, input.channel);
            const streams = await dispatcharr.channelStreams(channel.id);
            return [
              `${channelNumber(channel) ?? '-'} ${channelName(channel)} (id ${channel.id}, uuid ${channel.uuid})`,
              `Grupo: ${groupName(channel.effective_channel_group_id ?? channel.channel_group_id)}; tvg-id: ${channel.effective_tvg_id ?? channel.tvg_id ?? '—'}; EPG: ${channel.effective_epg_data_id ?? channel.epg_data_id ?? 'sem'}${channel.hidden_from_output ? '; escondido das listas' : ''}${channel.auto_created ? `; criado pela sincronização${channel.auto_created_by_name ? ` de ${channel.auto_created_by_name}` : ''}` : ''}`,
              streams.length
                ? `Streams (por prioridade):\n${streams
                    .map(
                      (stream, index) =>
                        `${index + 1}. ${stream.name}${stream.is_stale ? ' (desaparecido da lista)' : ''} — conta M3U ${stream.m3u_account ?? 'própria'} (stream ${stream.id})`,
                    )
                    .join('\n')}`
                : 'Sem streams.',
            ].join('\n');
          }
          const limit = Math.min(input.limit ?? 100, 500);
          const { items, total } = await dispatcharr.channels({
            search: input.search,
            group: input.group,
            limit,
          });
          if (!items.length) return 'Nenhum canal.';
          return [
            `${total} canais${total > items.length ? ` (mostro ${items.length})` : ''}:`,
            ...items.map(
              (channel) =>
                `- ${channelNumber(channel) ?? '-'} ${channelName(channel)} — ${groupName(channel.effective_channel_group_id ?? channel.channel_group_id)}, ${channel.streams?.length ?? 0} streams${(channel.effective_epg_data_id ?? channel.epg_data_id) ? '' : ', sem EPG'}${channel.hidden_from_output ? ', escondido' : ''} (id ${channel.id})`,
            ),
          ].join('\n');
        },
      ),
    },
    {
      name: 'dispatcharr_streams',
      description:
        'Os streams que vêm das contas M3U do Dispatcharr (a matéria-prima dos canais): procura pelo nome, filtra por conta M3U (id) ou grupo, e diz quantos espectadores e se desapareceu da lista.',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          m3uAccount: { type: 'integer' },
          group: { type: 'string' },
          limit: { type: 'integer', description: 'Até 300 (omissão 50).' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          dispatcharr,
          input: {
            search?: string;
            m3uAccount?: number;
            group?: string;
            limit?: number;
          },
        ) => {
          const { items, total } = await dispatcharr.streams({
            search: input.search,
            m3uAccount: input.m3uAccount,
            group: input.group,
            limit: Math.min(input.limit ?? 50, 300),
          });
          if (!items.length) return 'Nenhum stream.';
          return [
            `${total} streams${total > items.length ? ` (mostro ${items.length})` : ''}:`,
            ...items.map(
              (stream) =>
                `- ${stream.name}${stream.tvg_id ? ` [${stream.tvg_id}]` : ''} — conta ${stream.m3u_account ?? 'própria'}${stream.current_viewers ? `, ${stream.current_viewers} a ver` : ''}${stream.is_stale ? ', desaparecido da lista' : ''} (stream ${stream.id})`,
            ),
          ].join('\n');
        },
      ),
    },
    {
      name: 'dispatcharr_channel_edit',
      description:
        'Muda um canal do Dispatcharr (id, número ou nome): o nome, o número, o grupo (nome), o tvg-id, os streams por ordem de prioridade (ids, substituem os que tem) ou se fica escondido das listas. Nos canais criados pela sincronização das M3U, a mudança fica guardada à parte e sobrevive às sincronizações. Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          name: { type: 'string' },
          number: { type: 'number' },
          group: { type: 'string' },
          tvgId: { type: 'string' },
          streams: { type: 'array', items: { type: 'integer' } },
          hidden: { type: 'boolean' },
          account: ACCOUNT,
        },
        required: ['channel'],
      },
      handler: run(
        async (
          dispatcharr,
          input: {
            channel: string;
            name?: string;
            number?: number;
            group?: string;
            tvgId?: string;
            streams?: number[];
            hidden?: boolean;
          },
        ) => {
          const channel = await findChannel(dispatcharr, input.channel);
          const fields: Record<string, unknown> = {};
          if (input.name?.trim()) fields.name = input.name.trim();
          if (input.number !== undefined) fields.channel_number = input.number;
          if (input.group?.trim()) {
            fields.channel_group_id = pickGroup(
              await dispatcharr.groups(),
              input.group,
            ).id;
          }
          if (input.tvgId !== undefined) fields.tvg_id = input.tvgId.trim();
          const direct: Record<string, unknown> = {};
          if (input.streams) direct.streams = input.streams;
          if (input.hidden !== undefined)
            direct.hidden_from_output = input.hidden;
          if (!Object.keys(fields).length && !Object.keys(direct).length)
            return 'Diz o que mudar.';
          const body = channel.auto_created
            ? {
                ...direct,
                ...(Object.keys(fields).length ? { override: fields } : {}),
              }
            : { ...direct, ...fields };
          const updated = await dispatcharr.updateChannel(channel.id, body);
          return `Mudei o canal ${channelNumber(updated) ?? '-'} ${channelName(updated)} (id ${updated.id}): ${[
            ...Object.keys(fields),
            ...Object.keys(direct),
          ].join(', ')}.`;
        },
      ),
    },
    {
      name: 'dispatcharr_channel_create',
      description:
        'Cria um canal no Dispatcharr a partir de um stream (o id vem de dispatcharr_streams), com nome e número opcionais (sem número, fica o próximo livre). Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          stream: { type: 'integer' },
          name: { type: 'string' },
          number: { type: 'number' },
          account: ACCOUNT,
        },
        required: ['stream'],
      },
      handler: run(
        async (
          dispatcharr,
          input: { stream: number; name?: string; number?: number },
        ) => {
          const created = await dispatcharr.createChannelFromStream({
            stream_id: input.stream,
            ...(input.name?.trim() ? { name: input.name.trim() } : {}),
            ...(input.number !== undefined
              ? { channel_number: input.number }
              : {}),
          });
          return `Criei o canal ${channelNumber(created) ?? '-'} ${channelName(created)} (id ${created.id}).`;
        },
      ),
    },
    {
      name: 'dispatcharr_channel_delete',
      description:
        'Apaga um canal do Dispatcharr (id, número ou nome). Os streams ficam; os canais criados pela sincronização das M3U podem voltar na próxima. Confirma com ele antes. Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: { channel: { type: 'string' }, account: ACCOUNT },
        required: ['channel'],
      },
      handler: run(async (dispatcharr, input: { channel: string }) => {
        const channel = await findChannel(dispatcharr, input.channel);
        await dispatcharr.deleteChannel(channel.id);
        return `Apaguei o canal ${channelNumber(channel) ?? '-'} ${channelName(channel)}.`;
      }),
    },
    {
      name: 'dispatcharr_refresh',
      description:
        'Atualiza no Dispatcharr as listas M3U (target m3u) ou o guia EPG (target epg): sem id, todas; com id (de dispatcharr_overview), só essa. Corre em segundo plano: vê o resultado no estado com dispatcharr_overview. Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          target: { type: 'string', enum: ['m3u', 'epg'] },
          id: { type: 'integer' },
          force: {
            type: 'boolean',
            description: 'EPG: descarrega mesmo sem mudanças.',
          },
          account: ACCOUNT,
        },
        required: ['target'],
      },
      handler: run(
        async (
          dispatcharr,
          input: { target: 'm3u' | 'epg'; id?: number; force?: boolean },
        ) => {
          if (input.target === 'm3u') {
            const result = await dispatcharr.refreshM3u(input.id);
            if (result.success === false)
              return `O Dispatcharr não começou a atualizar as M3U${result.message ? `: ${result.message}` : '.'}`;
            return `Comecei a atualizar ${input.id ? `a conta M3U ${input.id}` : 'todas as contas M3U'}${result.message ? ` (${result.message})` : ''}.`;
          }
          const result = await dispatcharr.refreshEpg(input.id, input.force);
          if (result.success === false)
            return `O Dispatcharr não começou a atualizar o EPG${result.message ? `: ${result.message}` : '.'}`;
          return `Comecei a atualizar ${input.id ? `a fonte de EPG ${input.id}` : 'todas as fontes de EPG'}${result.message ? ` (${result.message})` : ''}.`;
        },
      ),
    },
    {
      name: 'dispatcharr_connections',
      description:
        'Quem está a ver pelo Dispatcharr agora: os canais a dar, o stream e o débito, há quanto tempo, se estão saudáveis, e os clientes (IP, app) de cada um; mais as ligações VOD e catch-up.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (dispatcharr) => {
        const stats = await dispatcharr.stats();
        const live = stats.live?.channels ?? [];
        return [
          live.length
            ? `Canais a dar (${live.length}):\n${live.map(liveLine).join('\n')}`
            : 'Nenhum canal a dar.',
          stats.vod?.count ? `VOD: ${stats.vod.count} ligações.` : '',
          stats.catchup?.count
            ? `Catch-up: ${stats.catchup.count} sessões.`
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
    {
      name: 'dispatcharr_stop',
      description:
        'Para um canal que está a dar no Dispatcharr (corta todos os clientes e liberta a ligação ao fornecedor) ou, com client, desliga só esse cliente. Os uuids vêm de dispatcharr_connections. Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'O uuid do canal.' },
          client: { type: 'string' },
          account: ACCOUNT,
        },
        required: ['channel'],
      },
      handler: run(
        async (dispatcharr, input: { channel: string; client?: string }) => {
          if (input.client?.trim()) {
            await dispatcharr.stopClient(input.channel, input.client.trim());
            return `Desliguei o cliente ${input.client}.`;
          }
          await dispatcharr.stopChannel(input.channel);
          return 'Parei o canal.';
        },
      ),
    },
    {
      name: 'dispatcharr_recordings',
      description:
        'As gravações do DVR do Dispatcharr (feitas e agendadas, com o canal e o programa). Com action schedule, agenda uma gravação num canal entre start e end ("AAAA-MM-DD HH:mm" à hora de Lisboa, ou ISO 8601 com fuso); com action delete, apaga uma gravação (id) — confirma com ele antes. schedule e delete só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'schedule', 'delete'] },
          channel: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          title: { type: 'string' },
          id: { type: 'integer' },
          upcomingOnly: { type: 'boolean' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          dispatcharr,
          input: {
            action?: 'list' | 'schedule' | 'delete';
            channel?: string;
            start?: string;
            end?: string;
            title?: string;
            id?: number;
            upcomingOnly?: boolean;
          },
        ) => {
          if (input.action === 'schedule') {
            if (!input.channel || !input.start || !input.end)
              return 'Diz o canal, o início e o fim.';
            const start = parseLisbonDate(input.start);
            const end = parseLisbonDate(input.end);
            if (!start || !end)
              return 'O início ou o fim não são datas válidas (usa "AAAA-MM-DD HH:mm", hora de Lisboa).';
            if (end <= start) return 'O fim tem de ser depois do início.';
            const channel = await findChannel(dispatcharr, input.channel);
            const created = await dispatcharr.createRecording({
              channel: channel.id,
              start_time: start.toISOString(),
              end_time: end.toISOString(),
              title: input.title?.trim(),
            });
            return `Agendei a gravação ${created.id} em ${channelName(channel)}: ${when(created.start_time)} → ${when(created.end_time)}.`;
          }
          if (input.action === 'delete') {
            if (!input.id) return 'Diz o id da gravação.';
            await dispatcharr.deleteRecording(input.id);
            return `Apaguei a gravação ${input.id}.`;
          }
          const recordings = (await dispatcharr.recordings())
            .filter(
              (item) =>
                !input.upcomingOnly || new Date(item.end_time) > new Date(),
            )
            .sort((a, b) => b.start_time.localeCompare(a.start_time))
            .slice(0, 100);
          if (!recordings.length) return 'Sem gravações.';
          const { items } = await dispatcharr.channels({ limit: 2000 });
          const names = new Map(
            items.map((channel) => [channel.id, channelName(channel)]),
          );
          return recordings
            .map((item) => recordingLine(item, names))
            .join('\n');
        },
      ),
    },
    {
      name: 'dispatcharr_backups',
      description:
        'Os backups do próprio Dispatcharr (zip da base de dados, no servidor): list mostra-os com o tamanho e o horário automático; create faz um agora e espera que acabe. create só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'create'] },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (dispatcharr, input: { action?: 'list' | 'create' }) => {
          if (input.action === 'create') {
            const filename = await dispatcharr.createBackup(5 * 60_000);
            return `Fiz o backup ${filename} no Dispatcharr.`;
          }
          const [backups, schedule] = await Promise.all([
            dispatcharr.backups(),
            dispatcharr.backupSchedule().catch(() => null),
          ]);
          return [
            schedule
              ? `Horário: ${JSON.stringify(schedule).slice(0, 300)}`
              : '',
            backups.length
              ? backups
                  .map(
                    (backup) =>
                      `- ${backup.name} — ${(backup.size / 1024 ** 2).toFixed(1)} MB, ${when(backup.created)}`,
                  )
                  .join('\n')
              : 'Não há backups no Dispatcharr.',
          ]
            .filter(Boolean)
            .join('\n');
        },
      ),
    },
  ];
}
