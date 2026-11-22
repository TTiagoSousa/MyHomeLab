import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import {
  createJellyfinClient,
  JellyfinClient,
  JellyfinItem,
  JellyfinPlugin,
  JellyfinSession,
  JellyfinTask,
  JellyfinUser,
  jellyfinDuration,
} from 'src/jellyfin/jellyfin.client';
import { lisbonStamp } from 'src/utils/lisbonTime';

const fold = (text: string) => text.trim().toLowerCase();

const ACCOUNT = {
  type: 'string' as const,
  description: 'O Jellyfin (nome ou endereço). Omite quando só há um.',
};

const ITEM_TYPES = [
  'Movie',
  'Series',
  'Season',
  'Episode',
  'MusicAlbum',
  'MusicArtist',
  'Audio',
  'MusicVideo',
  'BoxSet',
  'Book',
  'Playlist',
];

const when = (iso?: string | null) => lisbonStamp(iso, 'nunca');

/** O Jellyfin a usar: o único, ou o que bate com o nome ou o endereço. */
export async function jellyfinTarget(
  context: AgentContext,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await context.connectedAccountRepository.findAllByUser(
      context.userId,
      ConnectionProvider.JELLYFIN,
    )
  ).filter(
    (account) => account.isActive && account.baseUrl && account.accessToken,
  );
  if (!accounts.length) {
    return 'Não há nenhum Jellyfin ligado. Liga-o em Apps ligadas → Jellyfin.';
  }
  const label = (account: ConnectedAccount) =>
    `${account.displayName ?? 'Jellyfin'} (${account.baseUrl})`;
  const matches = wanted?.trim()
    ? accounts.filter((account) => fold(label(account)).includes(fold(wanted)))
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o Jellyfin: ${accounts.map(label).join(', ')}.`;
  }
  return matches[0];
}

/** Uma coisa pelo id ou pelo nome, sem ambiguidade. */
export function pickByName<T>(
  all: T[],
  wanted: string,
  name: (item: T) => string,
  itemId: (item: T) => string,
  what: string,
): T {
  const target = fold(wanted);
  const exact = all.find(
    (item) => fold(itemId(item)) === target || fold(name(item)) === target,
  );
  if (exact) return exact;
  const partial = all.filter((item) => fold(name(item)).includes(target));
  if (partial.length === 1) return partial[0];
  throw new Error(
    partial.length
      ? `há vários ${what} com «${wanted}»: ${partial.map(name).join(', ')}`
      : `não há ${what} «${wanted}» (há: ${all.map(name).slice(0, 30).join(', ')})`,
  );
}

const itemTitle = (item: JellyfinItem) =>
  item.Type === 'Episode' && item.SeriesName
    ? `${item.SeriesName} S${String(item.ParentIndexNumber ?? 0).padStart(2, '0')}E${String(item.IndexNumber ?? 0).padStart(2, '0')} «${item.Name}»`
    : `${item.Name}${item.ProductionYear ? ` (${item.ProductionYear})` : ''}`;

const itemLine = (item: JellyfinItem) =>
  `- ${itemTitle(item)} — ${item.Type}, id ${item.Id}`;

const sessionLine = (session: JellyfinSession) => {
  const playing = session.NowPlayingItem;
  const position = jellyfinDuration(session.PlayState?.PositionTicks);
  const length = jellyfinDuration(playing?.RunTimeTicks);
  const transcoding = session.TranscodingInfo
    ? session.TranscodingInfo.IsVideoDirect === false ||
      session.TranscodingInfo.IsAudioDirect === false
      ? `, a transcodificar${session.TranscodingInfo.TranscodeReasons?.length ? ` (${session.TranscodingInfo.TranscodeReasons.join(', ')})` : ''}`
      : ''
    : '';
  return `- ${session.UserName ?? 'sem utilizador'} em ${session.Client ?? '?'} / ${session.DeviceName ?? '?'}${session.RemoteEndPoint ? ` (${session.RemoteEndPoint})` : ''}${
    playing
      ? ` — a ver ${playing.SeriesName ? `${playing.SeriesName}: ` : ''}${playing.Name}${position ? ` ${position}${length ? `/${length}` : ''}` : ''}${session.PlayState?.IsPaused ? ', em pausa' : ''}${session.PlayState?.PlayMethod ? `, ${session.PlayState.PlayMethod}` : ''}${transcoding}`
      : ' — parado'
  } (sessão ${session.Id})`;
};

const userLine = (user: JellyfinUser) =>
  `- ${user.Name}${user.Policy?.IsAdministrator ? ' (administrador)' : ''}${user.Policy?.IsDisabled ? ' — DESLIGADO' : ''}${user.HasPassword === false ? ', sem password' : ''}, última entrada ${when(user.LastLoginDate)}, última atividade ${when(user.LastActivityDate)} (id ${user.Id})`;

const taskLine = (task: JellyfinTask) =>
  `- ${task.Name} [${task.Category ?? ''}] — ${task.State}${task.State === 'Running' && task.CurrentProgressPercentage != null ? ` ${Math.round(task.CurrentProgressPercentage)}%` : ''}; última: ${task.LastExecutionResult?.Status ?? 'nunca'} ${when(task.LastExecutionResult?.EndTimeUtc)}${task.LastExecutionResult?.ErrorMessage ? ` — erro: ${task.LastExecutionResult.ErrorMessage.slice(0, 200)}` : ''} (id ${task.Id})`;

export function buildJellyfinTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(
      work: (
        jellyfin: JellyfinClient,
        input: T,
        account: ConnectedAccount,
      ) => Promise<string>,
    ) =>
    async (input: T & { account?: string }) => {
      const account = await jellyfinTarget(context, input.account);
      if (typeof account === 'string') return account;
      try {
        return await work(
          createJellyfinClient(
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
      name: 'jellyfin_overview',
      description:
        'O Jellyfin (servidor de filmes, séries e música): a versão, se espera um reinício ou tem atualização, as bibliotecas, quantos filmes/séries/episódios/músicas, quem está a ver agora, as tarefas a correr ou que falharam e os plugins.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (jellyfin) => {
        const [info, libraries, counts, sessions, tasks, plugins] =
          await Promise.all([
            jellyfin.info(),
            jellyfin.libraries(),
            jellyfin.counts().catch(() => null),
            jellyfin.sessions(300).catch((): JellyfinSession[] => []),
            jellyfin.tasks().catch((): JellyfinTask[] => []),
            jellyfin.plugins().catch((): JellyfinPlugin[] => []),
          ]);
        const playing = sessions.filter((session) => session.NowPlayingItem);
        const running = tasks.filter((task) => task.State === 'Running');
        const failed = tasks.filter(
          (task) =>
            task.LastExecutionResult?.Status &&
            !['Completed', 'Cancelled'].includes(
              task.LastExecutionResult.Status,
            ),
        );
        return [
          `Jellyfin ${info.Version ?? '?'} — «${info.ServerName ?? ''}»${info.OperatingSystemDisplayName ? ` em ${info.OperatingSystemDisplayName}` : ''}${info.HasPendingRestart ? '; ESPERA UM REINÍCIO' : ''}${info.HasUpdateAvailable ? '; há atualização' : ''}.`,
          counts
            ? `Itens: ${counts.MovieCount ?? 0} filmes, ${counts.SeriesCount ?? 0} séries (${counts.EpisodeCount ?? 0} episódios), ${counts.AlbumCount ?? 0} álbuns (${counts.SongCount ?? 0} músicas)${counts.BookCount ? `, ${counts.BookCount} livros` : ''}${counts.BoxSetCount ? `, ${counts.BoxSetCount} coleções` : ''}.`
            : '',
          `Bibliotecas: ${
            libraries
              .map(
                (library) =>
                  `${library.Name} (${library.CollectionType ?? 'misto'}${library.RefreshStatus && library.RefreshStatus !== 'Idle' ? `, ${library.RefreshStatus}` : ''})`,
              )
              .join(', ') || 'nenhuma'
          }.`,
          playing.length
            ? `A ver agora (${playing.length}):\n${playing.map(sessionLine).join('\n')}`
            : `Ninguém a ver agora (${sessions.length} sessões ativas).`,
          running.length
            ? `Tarefas a correr: ${running.map((task) => `${task.Name}${task.CurrentProgressPercentage != null ? ` ${Math.round(task.CurrentProgressPercentage)}%` : ''}`).join(', ')}.`
            : '',
          failed.length
            ? `Tarefas que falharam da última vez:\n${failed.map(taskLine).join('\n')}`
            : '',
          plugins.length
            ? `Plugins: ${plugins.map((plugin) => `${plugin.Name} ${plugin.Version ?? ''}${plugin.Status && plugin.Status !== 'Active' ? ` (${plugin.Status})` : ''}`).join(', ')}.`
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
    {
      name: 'jellyfin_libraries',
      description:
        'As bibliotecas do Jellyfin com o tipo, as pastas no disco, o estado da procura e quantos itens tem cada uma; com recent, também os últimos itens adicionados.',
      inputSchema: {
        type: 'object',
        properties: {
          recent: {
            type: 'integer',
            description: 'Quantos dos últimos adicionados mostrar (até 50).',
          },
          library: {
            type: 'string',
            description: 'Só esta biblioteca (nome).',
          },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (jellyfin, input: { recent?: number; library?: string }) => {
          const all = await jellyfin.libraries();
          const chosen = input.library
            ? [
                pickByName(
                  all,
                  input.library,
                  (item) => item.Name,
                  (item) => item.ItemId,
                  'biblioteca',
                ),
              ]
            : all;
          const lines = await Promise.all(
            chosen.map(async (library) => {
              const count = await jellyfin
                .countIn(library.ItemId)
                .catch(() => null);
              return `- ${library.Name} — ${library.CollectionType ?? 'misto'}, ${count ?? '?'} itens${library.RefreshStatus && library.RefreshStatus !== 'Idle' ? `, ${library.RefreshStatus}${library.RefreshProgress != null ? ` ${Math.round(library.RefreshProgress)}%` : ''}` : ''}; pastas: ${(library.Locations ?? []).join(', ') || '—'} (id ${library.ItemId})`;
            }),
          );
          const recent = input.recent
            ? await jellyfin.latest(
                Math.min(input.recent, 50),
                input.library ? chosen[0].ItemId : undefined,
              )
            : [];
          return [
            lines.join('\n') || 'Sem bibliotecas.',
            recent.length
              ? `Últimos adicionados:\n${recent.map((item) => `${itemLine(item)}, ${when(item.DateCreated)}`).join('\n')}`
              : '',
          ]
            .filter(Boolean)
            .join('\n');
        },
      ),
    },
    {
      name: 'jellyfin_scan',
      description:
        'Procura ficheiros novos no Jellyfin: sem library nem item, em todas as bibliotecas; com library (nome) ou item (id), só aí. Com replaceMetadata/replaceImages volta a buscar os metadados/imagens de raiz (mais lento). Corre em segundo plano. Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          library: { type: 'string' },
          item: { type: 'string', description: 'O id de um item.' },
          replaceMetadata: { type: 'boolean' },
          replaceImages: { type: 'boolean' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          jellyfin,
          input: {
            library?: string;
            item?: string;
            replaceMetadata?: boolean;
            replaceImages?: boolean;
          },
        ) => {
          const options = {
            recursive: true,
            replaceAllMetadata: input.replaceMetadata,
            replaceAllImages: input.replaceImages,
          };
          if (input.item?.trim()) {
            await jellyfin.refresh(input.item.trim(), options);
            return `Comecei a atualizar o item ${input.item.trim()}.`;
          }
          if (input.library?.trim()) {
            const library = pickByName(
              await jellyfin.libraries(),
              input.library,
              (item) => item.Name,
              (item) => item.ItemId,
              'biblioteca',
            );
            await jellyfin.refresh(library.ItemId, options);
            return `Comecei a procurar na biblioteca ${library.Name} (vê o progresso com jellyfin_libraries).`;
          }
          await jellyfin.scanAll();
          return 'Comecei a procurar em todas as bibliotecas (vê o progresso com jellyfin_tasks ou jellyfin_libraries).';
        },
      ),
    },
    {
      name: 'jellyfin_search',
      description:
        'Procura no Jellyfin filmes, séries, episódios, música… pelo nome (types filtra pelo tipo). Com id, mostra os detalhes de um item: sinopse, géneros, duração, ficheiro, codecs, ids externos (IMDb/TMDb).',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          types: { type: 'array', items: { type: 'string', enum: ITEM_TYPES } },
          id: { type: 'string', description: 'O id de um item.' },
          limit: { type: 'integer', description: 'Até 100 (omissão 25).' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          jellyfin,
          input: {
            text?: string;
            types?: string[];
            id?: string;
            limit?: number;
          },
        ) => {
          if (input.id?.trim()) {
            const item = await jellyfin.item(input.id.trim());
            const source = item.MediaSources?.[0];
            const streams = (source?.MediaStreams ?? [])
              .map(
                (stream) =>
                  `${stream.Type}: ${stream.DisplayTitle ?? stream.Codec ?? ''}`,
              )
              .slice(0, 12);
            return [
              `${itemTitle(item)} — ${item.Type} (id ${item.Id})`,
              item.Genres?.length ? `Géneros: ${item.Genres.join(', ')}` : '',
              item.RunTimeTicks
                ? `Duração: ${jellyfinDuration(item.RunTimeTicks)}`
                : '',
              item.CommunityRating
                ? `Nota: ${item.CommunityRating.toFixed(1)}${item.OfficialRating ? ` · ${item.OfficialRating}` : ''}`
                : '',
              item.ChildCount != null
                ? `Contém: ${item.ChildCount}${item.RecursiveItemCount != null ? ` (${item.RecursiveItemCount} no total)` : ''}`
                : '',
              item.Path ? `Ficheiro: ${item.Path}` : '',
              source
                ? `Formato: ${source.Container ?? '?'}${source.Size ? `, ${(source.Size / 1024 ** 3).toFixed(2)} GB` : ''}${source.Bitrate ? `, ${Math.round(source.Bitrate / 1000)} kbps` : ''}`
                : '',
              streams.length ? `Faixas: ${streams.join(' | ')}` : '',
              item.ProviderIds && Object.keys(item.ProviderIds).length
                ? `Ids: ${Object.entries(item.ProviderIds)
                    .map(([key, value]) => `${key} ${value}`)
                    .join(', ')}`
                : '',
              `Adicionado: ${when(item.DateCreated)}`,
              item.Overview ? `Sinopse: ${item.Overview.slice(0, 800)}` : '',
            ]
              .filter(Boolean)
              .join('\n');
          }
          if (!input.text?.trim()) return 'Diz o que procurar (text) ou o id.';
          const { items, total } = await jellyfin.search(input.text.trim(), {
            types: input.types,
            limit: Math.min(input.limit ?? 25, 100),
          });
          if (!items.length) return `Nada com «${input.text}».`;
          return [
            `${total} resultados${total > items.length ? ` (mostro ${items.length})` : ''}:`,
            ...items.map(itemLine),
          ].join('\n');
        },
      ),
    },
    {
      name: 'jellyfin_sessions',
      description:
        'Quem está ligado ao Jellyfin: o utilizador, a app e o aparelho, o IP, o que está a ver, em que ponto, se está em pausa e se o servidor está a transcodificar (e porquê).',
      inputSchema: {
        type: 'object',
        properties: {
          playingOnly: { type: 'boolean' },
          account: ACCOUNT,
        },
      },
      handler: run(async (jellyfin, input: { playingOnly?: boolean }) => {
        const sessions = (await jellyfin.sessions()).filter(
          (session) => !input.playingOnly || session.NowPlayingItem,
        );
        if (!sessions.length) return 'Ninguém ligado.';
        return sessions.map(sessionLine).join('\n');
      }),
    },
    {
      name: 'jellyfin_session_control',
      description:
        'Numa sessão do Jellyfin (o id vem de jellyfin_sessions): manda uma mensagem para o ecrã (message), ou para, pausa ou retoma o que está a dar (stop, pause, unpause). Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          session: { type: 'string' },
          action: {
            type: 'string',
            enum: ['message', 'stop', 'pause', 'unpause'],
          },
          text: { type: 'string', description: 'A mensagem (para message).' },
          account: ACCOUNT,
        },
        required: ['session', 'action'],
      },
      handler: run(
        async (
          jellyfin,
          input: {
            session: string;
            action: 'message' | 'stop' | 'pause' | 'unpause';
            text?: string;
          },
        ) => {
          if (input.action === 'message') {
            if (!input.text?.trim()) return 'Diz a mensagem (text).';
            await jellyfin.sendMessage(
              input.session,
              'MyHomeLab',
              input.text.trim(),
            );
            return 'Mensagem enviada.';
          }
          const command = (
            { stop: 'Stop', pause: 'Pause', unpause: 'Unpause' } as const
          )[input.action];
          await jellyfin.playback(input.session, command);
          return `Feito (${input.action}).`;
        },
      ),
    },
    {
      name: 'jellyfin_users',
      description:
        'Os utilizadores do Jellyfin: quem é administrador, quem está desligado, quem não tem password, a última entrada e a última atividade.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (jellyfin) => {
        const users = await jellyfin.users();
        return users.length
          ? users.map(userLine).join('\n')
          : 'Sem utilizadores.';
      }),
    },
    {
      name: 'jellyfin_user_manage',
      description:
        'Gere um utilizador do Jellyfin: create (nome e password), disable/enable (desliga ou volta a ligar a conta, sem apagar nada) ou delete (apaga a conta e o histórico dela — confirma com ele antes). Faz só quando ele pedir. Não dá nem tira administrador.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'disable', 'enable', 'delete'],
          },
          user: {
            type: 'string',
            description: 'O nome (ou o id) do utilizador.',
          },
          password: { type: 'string', description: 'Para create.' },
          account: ACCOUNT,
        },
        required: ['action', 'user'],
      },
      handler: run(
        async (
          jellyfin,
          input: {
            action: 'create' | 'disable' | 'enable' | 'delete';
            user: string;
            password?: string;
          },
        ) => {
          if (input.action === 'create') {
            const created = await jellyfin.createUser(
              input.user.trim(),
              input.password,
            );
            return `Criei o utilizador ${created.Name} (id ${created.Id})${input.password ? '' : ' sem password — pede-lhe para pôr uma'}. Por omissão vê todas as bibliotecas.`;
          }
          const found = pickByName(
            await jellyfin.users(),
            input.user,
            (item) => item.Name,
            (item) => item.Id,
            'utilizador',
          );
          if (input.action === 'delete') {
            await jellyfin.deleteUser(found.Id);
            return `Apaguei o utilizador ${found.Name}.`;
          }
          const user = await jellyfin.user(found.Id);
          if (!user.Policy)
            return 'O Jellyfin não mostrou as regras deste utilizador.';
          const disable = input.action === 'disable';
          if (disable && user.Policy.IsAdministrator) {
            const admins = (await jellyfin.users()).filter(
              (item) => item.Policy?.IsAdministrator && !item.Policy.IsDisabled,
            );
            if (admins.length <= 1)
              return 'É o único administrador ligado: não o desligo.';
          }
          await jellyfin.setPolicy(user.Id, {
            ...user.Policy,
            IsDisabled: disable,
          });
          return `${disable ? 'Desliguei' : 'Voltei a ligar'} o utilizador ${user.Name}.`;
        },
      ),
    },
    {
      name: 'jellyfin_tasks',
      description:
        'As tarefas agendadas do Jellyfin (procurar nas bibliotecas, limpar a cache, extrair imagens, atualizar plugins…): o estado, o progresso, a última execução e o erro, se houver.',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          account: ACCOUNT,
        },
      },
      handler: run(async (jellyfin, input: { search?: string }) => {
        const tasks = (await jellyfin.tasks()).filter(
          (task) =>
            !input.search ||
            fold(`${task.Name} ${task.Category ?? ''}`).includes(
              fold(input.search),
            ),
        );
        return tasks.length
          ? tasks.map(taskLine).join('\n')
          : 'Nenhuma tarefa.';
      }),
    },
    {
      name: 'jellyfin_task_run',
      description:
        'Começa (start) ou para (stop) uma tarefa agendada do Jellyfin pelo nome ou pelo id (vê-os com jellyfin_tasks). Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          task: { type: 'string' },
          action: { type: 'string', enum: ['start', 'stop'] },
          account: ACCOUNT,
        },
        required: ['task'],
      },
      handler: run(
        async (
          jellyfin,
          input: { task: string; action?: 'start' | 'stop' },
        ) => {
          const task = pickByName(
            await jellyfin.tasks(),
            input.task,
            (item) => item.Name,
            (item) => item.Id,
            'tarefa',
          );
          if (input.action === 'stop') {
            await jellyfin.stopTask(task.Id);
            return `Pedi para parar «${task.Name}».`;
          }
          await jellyfin.startTask(task.Id);
          return `Comecei «${task.Name}» (vê o progresso com jellyfin_tasks).`;
        },
      ),
    },
    {
      name: 'jellyfin_activity',
      description:
        'O registo de atividade do Jellyfin, o mais recente primeiro: entradas (e falhadas), reproduções, itens adicionados, tarefas que falharam, plugins instalados. Filtra por texto ou por gravidade (só avisos e erros).',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          problemsOnly: { type: 'boolean' },
          limit: { type: 'integer', description: 'Até 200 (omissão 30).' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          jellyfin,
          input: { search?: string; problemsOnly?: boolean; limit?: number },
        ) => {
          const limit = Math.min(input.limit ?? 30, 200);
          const entries = (
            await jellyfin.activity(
              input.search || input.problemsOnly ? 500 : limit,
            )
          )
            .filter(
              (entry) =>
                (!input.problemsOnly ||
                  ['Warning', 'Error', 'Critical'].includes(
                    entry.Severity ?? '',
                  )) &&
                (!input.search ||
                  fold(`${entry.Name} ${entry.Overview ?? ''}`).includes(
                    fold(input.search),
                  )),
            )
            .slice(0, limit);
          if (!entries.length) return 'Sem atividade.';
          return entries
            .map(
              (entry) =>
                `- ${when(entry.Date)} ${entry.Severity && entry.Severity !== 'Information' ? `[${entry.Severity}] ` : ''}${entry.Name}${entry.ShortOverview ? ` — ${entry.ShortOverview.slice(0, 200)}` : ''}`,
            )
            .join('\n');
        },
      ),
    },
    {
      name: 'jellyfin_restart',
      description:
        'Reinicia o servidor Jellyfin (corta quem está a ver; serve para aplicar plugins ou mudanças que pedem reinício). Confirma com ele antes e diz-lhe se há alguém a ver. Faz só quando ele pedir.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (jellyfin) => {
        const playing = (
          await jellyfin.sessions(300).catch((): JellyfinSession[] => [])
        ).filter((session) => session.NowPlayingItem);
        await jellyfin.restart();
        return `Pedi o reinício ao Jellyfin${playing.length ? ` (cortou ${playing.length} a ver)` : ''}. Volta em menos de um minuto.`;
      }),
    },
    {
      name: 'jellyfin_server_backup',
      description:
        'Os backups do próprio Jellyfin (10.11 ou mais recente), guardados no disco do servidor: list mostra-os; create faz um agora (a base de dados e, se pedires, metadados, trickplay e legendas). Não sai do servidor: o backup do MyHomeLab (Apps ligadas → Jellyfin → Backups) guarda a configuração noutro destino. create só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'create'] },
          metadata: { type: 'boolean' },
          trickplay: { type: 'boolean' },
          subtitles: { type: 'boolean' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          jellyfin,
          input: {
            action?: 'list' | 'create';
            metadata?: boolean;
            trickplay?: boolean;
            subtitles?: boolean;
          },
        ) => {
          if (input.action === 'create') {
            const created = await jellyfin.createServerBackup(input);
            return `Fiz o backup no servidor: ${created.Path} (${when(created.DateCreated)}).`;
          }
          const backups = await jellyfin
            .serverBackups()
            .catch((error: unknown) => {
              if (error instanceof Error && /não encontrou/.test(error.message))
                throw new Error(
                  'este Jellyfin não tem backups no servidor (só a partir da 10.11)',
                );
              throw error;
            });
          if (!backups.length) return 'Não há backups no servidor.';
          return backups
            .map(
              (backup) =>
                `- ${when(backup.DateCreated)} — ${backup.Path} (versão ${backup.ServerVersion ?? '?'}${backup.Options?.Metadata ? ', com metadados' : ''})`,
            )
            .join('\n');
        },
      ),
    },
  ];
}
