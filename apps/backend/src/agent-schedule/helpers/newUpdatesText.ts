import { UpdateWithAccount } from 'src/app-update/app-update.types';
import { updateLabel } from 'src/app-update/helpers/updateFields';

/** O que um agendamento "quando aparece uma atualização nova" recebe: as que apareceram. */
export function newUpdatesText(updates: UpdateWithAccount[]): string {
  return [
    `Apareceram ${updates.length === 1 ? 'uma atualização nova' : `${updates.length} atualizações novas`} (disponíveis, ainda ninguém as abriu):`,
    ...updates.map(
      (update) =>
        `- ${updateLabel(update)} ${update.fromVersion} → ${update.toVersion} (update ${update.id})${update.component ? ' — peça dentro da app, com atualização própria' : ''}`,
    ),
    ...(updates.some((update) => update.component)
      ? [
          'As peças (apps dentro do Nextcloud, add-ons do Home Assistant…) são atualizações à parte: cada uma conta como uma app própria, por isso uma atualização da app (ou de outra peça) em aberto não as faz esperar.',
        ]
      : []),
    'Segue "Atualizações das apps e do Proxmox – como funcionam" (O disparo "Abrir cada update novo"): para cada uma, abre-a com update_start (passa para Espera por estudo e o estudo corre sozinho) ou diz porque não.',
  ].join('\n');
}
