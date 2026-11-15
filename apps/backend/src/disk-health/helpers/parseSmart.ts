import { ProxmoxSmart } from 'src/proxmox/proxmox.client';

export interface SmartValues {
  health: string | null;
  wearout: number | null;
  temperature: number | null;
  reallocated: number | null;
  pending: number | null;
  mediaErrors: number | null;
  powerOnHours: number | null;
}

/**
 * Os atributos ATA cujo valor normalizado é a vida que resta, pela ordem que o
 * próprio Proxmox usa (cada fabricante usa o seu).
 */
const WEAROUT_ATTRIBUTES = [177, 230, 231, 233, 202, 169];

/** "35 (Min/Max 20/45)", "12345h+12m", "1,234" → o primeiro número. */
const firstNumber = (raw: string | undefined): number | null => {
  const match = raw?.replace(/,/g, '').match(/\d+/);
  return match ? Number(match[0]) : null;
};

const fromText = (text: string, pattern: RegExp): number | null =>
  firstNumber(text.match(pattern)?.[1]);

/**
 * Tira do /disks/smart o que interessa. Discos SATA trazem a tabela de
 * atributos; NVMe (e alguns SAS) só o texto do smartctl, que se lê por linhas.
 */
export function parseSmart(smart: ProxmoxSmart): SmartValues {
  const values: SmartValues = {
    health: smart.health?.trim().toUpperCase() || null,
    wearout: null,
    temperature: null,
    reallocated: null,
    pending: null,
    mediaErrors: null,
    powerOnHours: null,
  };

  const attributes = smart.attributes ?? [];
  if (attributes.length) {
    const byId = (id: number) =>
      attributes.find((attribute) => Number(attribute.id) === id);
    values.reallocated = firstNumber(byId(5)?.raw);
    values.pending = firstNumber(byId(197)?.raw);
    values.temperature = firstNumber((byId(194) ?? byId(190))?.raw);
    values.powerOnHours = firstNumber(byId(9)?.raw);
    for (const id of WEAROUT_ATTRIBUTES) {
      const value = byId(id)?.value;
      if (value != null && value !== '' && Number.isFinite(Number(value))) {
        values.wearout = Math.min(Number(value), 100);
        break;
      }
    }
  }

  const text = smart.text ?? '';
  if (text) {
    values.temperature ??= fromText(text, /^Temperature:\s*(\d+)\s*Celsius/im);
    values.mediaErrors ??= fromText(
      text,
      /^Media and Data Integrity Errors:\s*([\d,]+)/im,
    );
    values.powerOnHours ??= fromText(text, /^Power On Hours:\s*([\d,.]+)/im);
    const used = fromText(text, /^Percentage Used:\s*(\d+)%/im);
    if (used != null) values.wearout ??= Math.max(100 - used, 0);
  }

  return values;
}
