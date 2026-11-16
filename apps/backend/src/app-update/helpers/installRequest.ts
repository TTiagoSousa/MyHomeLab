import { UpdateWithAccount } from '../app-update.types';
import { isHostUpdate, updateLabel } from './updateFields';

/**
 * O pedido para instalar uma atualização que está em Ready to update (logo que ele a
 * põe lá). Estar lá é a aprovação; as regras da app dizem o que validar.
 */
export function installRequest(
  update: UpdateWithAccount,
  server: string | null,
): string {
  return (
    `Instala a atualização ${updateLabel(update)} ${update.fromVersion} → ${update.toVersion} (update ${update.id}${update.boardTaskKey ? `, tarefa ${update.boardTaskKey}` : ''}). ` +
    'Está em Ready to update: foi ele que a pôs lá, ou o teu estudo (pequena e de risco baixo). Isso é a aprovação: não peças outro sim, nem por um salto major. O último gesto dele manda: se a pôs em Ready depois de um comentário com condições (uma hora, dias de rodagem, uma leitura por fazer), mudou de ideias e instala-se já; as regras de segurança dos documentos (backup, snapshot, partição EFI, nada a remover) continuam todas. Não voltes a perguntar o que já perguntaste. Ele não está a acompanhar: só o que precisa mesmo dele lhe chega às notificações. Os documentos da app vêm no fim deste pedido: segue-os à letra.\n' +
    (server ? `O servidor do projeto desta atualização: ${server}.\n` : '') +
    (isHostUpdate(update)
      ? `É o host Proxmox VE de ${update.hostServer?.name ?? 'servidor'} (sem snapshot); ele autorizou ao pô-la em Ready to update. Segue as regras do servidor (os documentos dele vêm no fim: antes de instalar, o backup da configuração, instalar, depois de instalar); não reinicies:\n`
      : 'Segue "Atualizações das apps e do Proxmox – como funcionam" e as regras da app (os documentos dela vêm no fim deste pedido; as apps dentro do Nextcloud seguem as regras do Nextcloud):\n') +
    '1. update_prepare sem checklist abre a tentativa com os pontos das regras.\n' +
    '2. Valida cada ponto e marca-o com update_check, com a prova. O que se resolve dentro das regras (backup, disco ou memória) resolve-se e volta a marcar-se.\n' +
    '3. Tudo validado (ou não se aplica) → update_prepare com checklist: [] e logo update_run.\n' +
    '4. Acompanha com update_status até acabar (espera sozinho até um minuto por chamada). Não acabes esta tarefa com os comandos a correr.\n' +
    `5. Se uma corrida falhar, fica em In progress e o MyHomeLab volta ao snapshot: não é o fim. Segue "Quando falha": lê o erro e o log, percebe a causa (issues, notas, registos anteriores). Se a solução for simples e segura, corrige o documento da app (docs_write), update_prepare com os comandos corrigidos e update_run outra vez, até 3 corridas no total. Se não, update_set_status waiting com o que falhou, a causa provável, o que tentaste e as opções.\n` +
    '6. Um ponto que não se valida e não se resolve dentro das regras → update_attempt_close com o porquê e update_set_status waiting com a pergunta exata (é isto que lhe chega às notificações).\n' +
    'No fim, uma frase com o resultado e o que corrigiste.'
  );
}
