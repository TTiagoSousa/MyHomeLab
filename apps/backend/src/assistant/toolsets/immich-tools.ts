import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { IMMICH_MANUAL_JOBS, IMMICH_QUEUES } from 'src/immich/immich.client';
import {
  albumDetail,
  changeSettings,
  immichTarget,
  listAlbums,
  listDuplicates,
  listPeople,
  listQueues,
  overview,
  readSettings,
  runJob,
  saveAlbum,
  searchAssets,
  updatePerson,
} from '../tools/immichTools';

const ACCOUNT = {
  type: 'string' as const,
  description: 'O Immich (nome ou endereço). Omite quando só há um.',
};

const ASSET_IDS = {
  type: 'array' as const,
  items: { type: 'string' as const },
  description: 'Os ids das fotos ou vídeos (de immich_search ou de um álbum).',
};

// As definições são fixas (a cache vive do prefixo igual); a chave só entra nos
// handlers, que leem apenas as contas deste utilizador.
export function buildImmichTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (account: ConnectedAccount, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const target = await immichTarget(
        context.connectedAccountRepository,
        context.userId,
        input.account,
      );
      return typeof target === 'string' ? target : work(target, input);
    };

  return [
    {
      name: 'immich_overview',
      description:
        'Resumo do Immich (as fotos e os vídeos): versão, de quem é a chave, quantas fotos e vídeos, o disco e as filas de tarefas com trabalho ou falhas.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => overview(account)),
    },
    {
      name: 'immich_search',
      description:
        'Procura fotos e vídeos. Com query, a pesquisa inteligente por descrição ("praia ao pôr do sol", "bolo de anos"); sem ela, pelos filtros (datas AAAA-MM-DD, cidade, país, tipo, favoritas, pessoas, nome do ficheiro). Os filtros também afinam a pesquisa inteligente. Devolve o id de cada item.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          query: { type: 'string' },
          taken_after: { type: 'string' },
          taken_before: { type: 'string' },
          city: { type: 'string' },
          country: { type: 'string' },
          type: { type: 'string', enum: ['IMAGE', 'VIDEO'] },
          favorite: { type: 'boolean' },
          person_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Os ids das pessoas (de immich_people).',
          },
          file_name: { type: 'string' },
          limit: { type: 'integer', description: 'Até 100 (por omissão 25).' },
        },
      },
      handler: run(searchAssets),
    },
    {
      name: 'immich_albums',
      description:
        'Os álbuns, com o id, quantos itens, as datas e se são partilhados.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => listAlbums(account)),
    },
    {
      name: 'immich_album',
      description: 'Um álbum e os itens dele.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          album_id: { type: 'string' },
          limit: { type: 'integer', description: 'Até 200 (por omissão 50).' },
        },
        required: ['album_id'],
      },
      handler: run(albumDetail),
    },
    {
      name: 'immich_save_album',
      description:
        'Sem album_id cria um álbum (name, description e as fotos em add_assets). Com album_id muda o nome ou a descrição, acrescenta fotos (add_assets) ou tira-as do álbum (remove_assets; as fotos ficam no Immich). Não apaga álbuns nem fotos.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          album_id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          add_assets: ASSET_IDS,
          remove_assets: ASSET_IDS,
        },
      },
      handler: run(saveAlbum),
    },
    {
      name: 'immich_people',
      description:
        'As pessoas que o Immich reconheceu nas fotos, com o id; primeiro as que têm nome. query filtra pelo nome.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          query: { type: 'string' },
          limit: { type: 'integer', description: 'Até 300 (por omissão 60).' },
        },
      },
      handler: run(listPeople),
    },
    {
      name: 'immich_update_person',
      description:
        'Dá ou muda o nome de uma pessoa reconhecida, a data de nascimento (AAAA-MM-DD, ou null para tirar) ou esconde-a (hidden).',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          person_id: { type: 'string' },
          name: { type: 'string' },
          birth_date: { type: ['string', 'null'] },
          hidden: { type: 'boolean' },
        },
        required: ['person_id'],
      },
      handler: run(updatePerson),
    },
    {
      name: 'immich_duplicates',
      description:
        'Os grupos de fotos duplicadas que o Immich encontrou (só para ver; resolver é no Immich).',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          limit: { type: 'integer', description: 'Até 100 (por omissão 20).' },
        },
      },
      handler: run(listDuplicates),
    },
    {
      name: 'immich_queues',
      description:
        'As filas de tarefas do Immich (miniaturas, metadados, vídeos, rostos, pesquisa inteligente, duplicados, backups…): o que corre, espera e falhou, e as que estão em pausa. Precisa da chave de um admin.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => listQueues(account)),
    },
    {
      name: 'immich_run_job',
      description:
        'Mexe nas tarefas do Immich (chave de admin). Com queue: action start corre o que está em falta (force: true refaz tudo, pesado), pause ou resume. Com job lança uma tarefa à mão (backup-database faz já um backup da base de dados).',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          queue: { type: 'string', enum: [...IMMICH_QUEUES] },
          action: { type: 'string', enum: ['start', 'pause', 'resume'] },
          force: { type: 'boolean' },
          job: { type: 'string', enum: [...IMMICH_MANUAL_JOBS] },
        },
      },
      handler: run(runJob),
    },
    {
      name: 'immich_settings',
      description:
        'As definições do servidor Immich (Administração → Definições; chave de admin). Sem section lista as partes (backup, ffmpeg, machineLearning, storageTemplate, trash, job, library, map, notifications, server, user…); com section ("backup.database", "machineLearning.facialRecognition") mostra os valores.',
      inputSchema: {
        type: 'object',
        properties: { account: ACCOUNT, section: { type: 'string' } },
      },
      handler: run(readSettings),
    },
    {
      name: 'immich_set_settings',
      description:
        'Muda definições do servidor Immich (chave de admin). changes é só o que muda, com a forma do immich_settings (ex.: {"backup":{"database":{"keepLastAmount":30}}} ou {"trash":{"days":60}}); o resto fica igual. Sem confirm mostra o que muda (antes → depois); com confirm: true aplica e devolve os valores de antes, para desfazer.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          changes: { type: 'object' },
          confirm: { type: 'boolean' },
        },
        required: ['changes'],
      },
      handler: run(changeSettings),
    },
  ];
}
