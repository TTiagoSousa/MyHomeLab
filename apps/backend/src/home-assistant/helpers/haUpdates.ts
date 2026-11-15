import { HaEntityEntry, HaState } from '../home-assistant.client';

/**
 * O que se atualiza dentro do Home Assistant, separado: o próprio sistema
 * (Core, Supervisor, OS), os add-ons, os repositórios do HACS, o firmware dos
 * dispositivos e o resto (integrações com atualização própria).
 */
export type HaUpdateGroup = 'system' | 'addons' | 'hacs' | 'firmware' | 'other';

export interface HaUpdateItem {
  entityId: string;
  group: HaUpdateGroup;
  title: string;
  installed: string | null;
  latest: string | null;
  /** Há uma versão nova (e não foi saltada). */
  pending: boolean;
  skipped: string | null;
  inProgress: boolean;
  autoUpdate: boolean;
  releaseUrl: string | null;
  releaseSummary: string | null;
  /** Os add-ons: o slug no Supervisor (para lhe pedir a ficha). */
  addonSlug: string | null;
}

export const HA_UPDATE_GROUPS: Record<HaUpdateGroup, string> = {
  system: 'Sistema (Core, Supervisor, OS)',
  addons: 'Add-ons',
  hacs: 'Repositórios do HACS',
  firmware: 'Firmware dos dispositivos',
  other: 'Outras integrações',
};

/** As plataformas que atualizam firmware de dispositivos. */
const FIRMWARE_PLATFORMS = new Set([
  'esphome',
  'zha',
  'zwave_js',
  'matter',
  'shelly',
  'tasmota',
  'unifi',
  'fritz',
  'tplink',
  'tradfri',
  'deconz',
]);

const SYSTEM_IDS =
  /^update\.home_assistant_(core|supervisor|operating_system)_update$/;

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

function groupOf(
  state: HaState,
  entry: HaEntityEntry | undefined,
): HaUpdateGroup {
  const platform = entry?.platform ?? '';
  if (SYSTEM_IDS.test(state.entity_id)) return 'system';
  if (platform === 'hassio') return 'addons';
  if (platform === 'hacs') return 'hacs';
  if (
    state.attributes.device_class === 'firmware' ||
    FIRMWARE_PLATFORMS.has(platform)
  ) {
    return 'firmware';
  }
  return 'other';
}

export function haUpdates(
  states: HaState[],
  entries: HaEntityEntry[],
): HaUpdateItem[] {
  const registry = new Map(entries.map((entry) => [entry.entity_id, entry]));
  return states
    .filter((state) => state.entity_id.startsWith('update.'))
    .map((state) => {
      const attributes = state.attributes;
      const entry = registry.get(state.entity_id);
      const latest = text(attributes.latest_version);
      const skipped = text(attributes.skipped_version);
      return {
        entityId: state.entity_id,
        group: groupOf(state, entry),
        title: (
          text(attributes.title) ??
          text(attributes.friendly_name) ??
          state.entity_id
        ).replace(/\s+(update|atualiza[cç][aã]o)$/i, ''),
        installed: text(attributes.installed_version),
        latest,
        pending: state.state === 'on' && (!skipped || skipped !== latest),
        skipped,
        inProgress: Boolean(attributes.in_progress),
        autoUpdate: Boolean(attributes.auto_update),
        releaseUrl: text(attributes.release_url),
        releaseSummary: text(attributes.release_summary),
        addonSlug:
          entry?.platform === 'hassio' && entry.unique_id
            ? entry.unique_id.replace(/_version_latest$/, '')
            : null,
      };
    })
    .sort(
      (a, b) =>
        Number(b.pending) - Number(a.pending) ||
        a.group.localeCompare(b.group) ||
        a.title.localeCompare(b.title),
    );
}
