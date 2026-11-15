import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  HomeAssistantTarget,
  callService,
  deleteConfig,
  getConfig,
  getEntity,
  homeAssistantTarget,
  listConfigs,
  listEntities,
  listServices,
  listUpdates,
  overview,
  saveConfig,
  systemLog,
  updateEntity,
} from '../tools/homeAssistantTools';

const ACCOUNT = {
  type: 'string' as const,
  description: 'O Home Assistant (nome ou endereço). Omite quando só há um.',
};

const KIND = {
  type: 'string' as const,
  enum: ['automation', 'script', 'scene'],
  description: 'automation, script ou scene.',
};

const ENTITY_ID = {
  type: 'string' as const,
  description: 'O id da entidade, ex.: light.sala.',
};

// As definições são fixas (a cache vive do prefixo igual); a conta e o token só
// entram nos handlers, que leem apenas as contas deste utilizador.
export function buildHomeAssistantTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (target: HomeAssistantTarget, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const target = await homeAssistantTarget(
        context.connectedAccountRepository,
        context.userId,
        input.account,
      );
      return typeof target === 'string' ? target : work(target, input);
    };

  return [
    {
      name: 'ha_overview',
      description:
        'Resumo do Home Assistant: versão, quantas entidades há por domínio, as áreas (com o id) e as atualizações por instalar. Bom ponto de partida.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((target) => overview(target)),
    },
    {
      name: 'ha_list_updates',
      description:
        'As atualizações dentro do Home Assistant, separadas: o sistema (Core, Supervisor, OS), os add-ons, os repositórios do HACS, o firmware dos dispositivos e outras integrações — com a versão instalada e a nova, as notas e se atualiza sozinha. Só leitura: não instala nada.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          all: {
            type: 'boolean',
            description: 'true para ver também as que estão em dia.',
          },
        },
      },
      handler: run((target, input: { all?: boolean }) =>
        listUpdates(target, input.all),
      ),
    },
    {
      name: 'ha_list_entities',
      description:
        'Lista entidades com o estado, a área e se estão desativadas ou ocultas. Filtra por domínio (light, switch, sensor…), área e/ou texto no id ou no nome.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          domain: {
            type: 'string',
            description: 'Ex.: light, sensor, climate.',
          },
          area: { type: 'string', description: 'O nome ou o id da área.' },
          search: { type: 'string', description: 'Texto no id ou no nome.' },
          limit: {
            type: 'integer',
            description: 'Quantas (1 a 300, 100 por omissão).',
          },
        },
      },
      handler: run(listEntities),
    },
    {
      name: 'ha_get_entity',
      description:
        'Abre uma entidade: estado, atributos, dispositivo e o registo (nome, ícone, área, integração, desativada/oculta).',
      inputSchema: {
        type: 'object',
        properties: { account: ACCOUNT, entity_id: ENTITY_ID },
        required: ['entity_id'],
      },
      handler: run(getEntity),
    },
    {
      name: 'ha_list_services',
      description:
        'Os serviços (ações) de um domínio e os campos que aceitam, ex.: light → turn_on com brightness_pct, color_name….',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          domain: {
            type: 'string',
            description: 'Ex.: light, climate, script.',
          },
        },
        required: ['domain'],
      },
      handler: run(listServices),
    },
    {
      name: 'ha_call_service',
      description:
        'Chama um serviço do Home Assistant: ligar/desligar, mudar o termóstato, correr um script (script.turn_on ou script.<id>), disparar uma automação (automation.trigger), ativar uma cena, recarregar, etc.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          domain: { type: 'string', description: 'Ex.: light.' },
          service: { type: 'string', description: 'Ex.: turn_on.' },
          entity_id: {
            description: 'Uma entidade ou uma lista delas.',
            anyOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } },
            ],
          },
          data: {
            type: 'object',
            description:
              'Os outros campos do serviço, ex.: {"brightness_pct": 40}.',
          },
          return_response: {
            type: 'boolean',
            description:
              'true para serviços que devolvem dados (ex.: weather.get_forecasts, calendar.get_events).',
          },
        },
        required: ['domain', 'service'],
      },
      handler: run(callService),
    },
    {
      name: 'ha_list_configs',
      description:
        'Lista as automações, os scripts ou as cenas: entidade, nome, estado, o id da configuração e a última vez que correram.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          kind: KIND,
          search: { type: 'string', description: 'Texto no id ou no nome.' },
        },
        required: ['kind'],
      },
      handler: run(listConfigs),
    },
    {
      name: 'ha_get_config',
      description:
        'A configuração completa (o YAML, em JSON) de uma automação, script ou cena, pelo id da configuração (o de ha_list_configs).',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          kind: KIND,
          id: { type: 'string', description: 'O id da configuração.' },
        },
        required: ['kind', 'id'],
      },
      handler: run(getConfig),
    },
    {
      name: 'ha_save_config',
      description:
        'Cria ou substitui uma automação, script ou cena. Sem id cria uma nova; com id substitui a configuração TODA (lê-a antes com ha_get_config e manda-a completa). O HA valida, grava e recarrega; devolve a versão anterior para se poder desfazer.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          kind: KIND,
          id: {
            type: 'string',
            description:
              'O id a substituir. Omite para criar (num script novo, o id sai do alias, ex.: "Boa noite" → script.boa_noite).',
          },
          config: {
            type: 'object',
            description:
              'A configuração no formato do HA em JSON. Automação: {"alias","description","mode","triggers":[…],"conditions":[…],"actions":[…]}. Script: {"alias","mode","sequence":[…]}. Cena: {"name","entities":{…}}.',
          },
        },
        required: ['kind', 'config'],
      },
      handler: run(saveConfig),
    },
    {
      name: 'ha_delete_config',
      description:
        'Apaga uma automação, script ou cena (pelo id da configuração). Devolve a configuração apagada.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          kind: KIND,
          id: { type: 'string', description: 'O id da configuração.' },
        },
        required: ['kind', 'id'],
      },
      handler: run(deleteConfig),
    },
    {
      name: 'ha_update_entity',
      description:
        'Muda o registo de uma entidade: nome, ícone, área, id da entidade, ativar/desativar e mostrar/ocultar. Só o que passares muda; nome ou ícone vazios voltam ao de origem, área vazia volta à do dispositivo.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          entity_id: ENTITY_ID,
          name: { type: 'string', description: 'O nome a mostrar.' },
          icon: { type: 'string', description: 'Ex.: mdi:lamp.' },
          area: { type: 'string', description: 'O nome ou o id da área.' },
          new_entity_id: {
            type: 'string',
            description:
              'O novo id, do mesmo domínio (ex.: light.candeeiro_sala).',
          },
          enabled: { type: 'boolean' },
          visible: { type: 'boolean' },
        },
        required: ['entity_id'],
      },
      handler: run(updateEntity),
    },
    {
      name: 'ha_system_log',
      description:
        'Os erros e avisos mais recentes do registo do Home Assistant (para perceber porque algo falhou).',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          limit: {
            type: 'integer',
            description: 'Quantos (até 50, 20 por omissão).',
          },
        },
      },
      handler: run(systemLog),
    },
  ];
}
