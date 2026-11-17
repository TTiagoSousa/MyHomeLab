import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { GAME_STATUSES, SHELVES } from 'src/gametracker/gametracker.client';
import {
  gameDetail,
  gameTrackerTarget,
  listShelf,
  overview,
  removeEntry,
  searchGames,
  setEntry,
  watchPrice,
  watchlist,
} from '../tools/gameTrackerTools';

const ACCOUNT = {
  type: 'string' as const,
  description: 'O GamesTracker (nome ou endereço). Omite quando só há um.',
};

const GAME_ID = {
  type: 'integer' as const,
  description: 'O id do jogo no IGDB (de gametracker_search ou da prateleira).',
};

// As definições são fixas (a cache vive do prefixo igual); o token só entra nos
// handlers, que leem apenas as contas deste utilizador.
export function buildGameTrackerTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (account: ConnectedAccount, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const target = await gameTrackerTarget(
        context.connectedAccountRepository,
        context.userId,
        input.account,
      );
      return typeof target === 'string' ? target : work(target, input);
    };

  return [
    {
      name: 'gametracker_overview',
      description:
        'Resumo do GamesTracker (a prateleira de jogos): versão, quantos jogos em cada estado, horas jogadas, nota média, géneros e o que está a jogar agora.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => overview(account)),
    },
    {
      name: 'gametracker_shelf',
      description:
        'Os jogos da prateleira, com estado, horas, nota, plataforma, datas e notas. Filtra por estante (shelf) ou por estados (status, separados por vírgulas).',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          shelf: {
            type: 'string',
            enum: [...SHELVES],
            description:
              'playing (a jogar e em pausa), finished (acabados), planned (para jogar), dropped (desistidos).',
          },
          status: {
            type: 'string',
            description: `Um ou mais, separados por vírgulas: ${GAME_STATUSES.join(', ')}.`,
          },
          limit: { type: 'integer', description: 'Até 200 (por omissão 50).' },
        },
      },
      handler: run(listShelf),
    },
    {
      name: 'gametracker_search',
      description:
        'Procura jogos no IGDB pelo nome. Devolve o id de cada um, que é o que se usa para o pôr na prateleira, ver o preço ou segui-lo.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          query: { type: 'string', description: 'Ex.: "hollow knight".' },
          limit: { type: 'integer', description: 'Até 30 (por omissão 10).' },
        },
        required: ['query'],
      },
      handler: run(searchGames),
    },
    {
      name: 'gametracker_game',
      description:
        'Um jogo: a ficha do IGDB (resumo, notas, tempo para acabar, DLCs), como está na prateleira e o melhor preço de agora.',
      inputSchema: {
        type: 'object',
        properties: { account: ACCOUNT, game_id: GAME_ID },
        required: ['game_id'],
      },
      handler: run(gameDetail),
    },
    {
      name: 'gametracker_set_game',
      description:
        'Põe um jogo na prateleira ou muda-o: o estado, as horas, a nota (1–10), a plataforma onde jogou, as datas (AAAA-MM-DD) e as notas. Só muda o que passares; o resto fica como estava. Para um jogo novo, o estado é obrigatório.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          game_id: GAME_ID,
          status: { type: 'string', enum: [...GAME_STATUSES] },
          hours_played: { type: ['number', 'null'] },
          rating: { type: ['integer', 'null'], minimum: 1, maximum: 10 },
          platform: {
            type: ['string', 'null'],
            description: 'Onde jogou, ex.: "PlayStation 5".',
          },
          started_at: { type: ['string', 'null'] },
          finished_at: { type: ['string', 'null'] },
          notes: { type: ['string', 'null'] },
        },
        required: ['game_id'],
      },
      handler: run(setEntry),
    },
    {
      name: 'gametracker_remove_game',
      description:
        'Tira um jogo da prateleira (perde as horas, a nota e as notas dele). Só com confirm: true, quando ele pediu para o tirar.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          game_id: GAME_ID,
          confirm: { type: 'boolean' },
        },
        required: ['game_id'],
      },
      handler: run(removeEntry),
    },
    {
      name: 'gametracker_watchlist',
      description:
        'Os jogos que segue (alertas de preço), com o alvo e o melhor preço de agora.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => watchlist(account)),
    },
    {
      name: 'gametracker_watch_price',
      description:
        'Segue um jogo para ter alerta de preço: com target_price avisa quando custar isso ou menos; sem ele, em qualquer promoção. stop: true deixa de o seguir.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          game_id: GAME_ID,
          target_price: { type: ['number', 'null'] },
          stop: { type: 'boolean' },
        },
        required: ['game_id'],
      },
      handler: run(watchPrice),
    },
  ];
}
