import { COMPONENT_LABELS } from '../app-update.constants';
import { UpdateWithAccount } from '../app-update.types';
import { lisbon } from './updateDates';
import { updateLabel } from './updateFields';

/** O pedido que o agente recebe para estudar uma atualização. */
export function studyRequest(update: UpdateWithAccount): string {
  const before = update.recommendation
    ? ` Já a estudaste antes${update.studiedAt ? ` (a ${lisbon(update.studiedAt)})` : ''}: risco ${update.risk ?? '?'}, "${update.recommendation}". ` +
      'Vê o que mudou desde então (issues novas ou fechadas, versões de correção, respostas do utilizador no histórico com update_status) e atualiza o relatório.'
    : '';
  return (
    `Estuda a atualização ${update.id}: ${updateLabel(update)} da ${update.fromVersion} para a ${update.toVersion}` +
    (update.boardTaskKey ? ` (tarefa ${update.boardTaskKey})` : '') +
    (update.account
      ? '. Segue "Atualizações das apps e do Proxmox – como funcionam" e as regras da app (os documentos dela vêm no fim deste pedido e mandam nos pormenores): update_release_notes, ' +
        'update_known_issues, as regras do estudo, e no fim update_save_study. ' +
        'Os documentos da app vêm no fim deste pedido: segue-os à letra. No fim decides: install (instalas tu já — só risco baixo, sem salto major nem passos à mão, quando as regras passam), recommend (recomendas, mas a decisão é dele: usa-o quando achas que é importante ele decidir), waiting (uma pergunta que só ele responde) ou later. Um salto major ou outra versão melhor não são perguntas: ficam na recomendação. ' +
        'O que precisa de ser lido ou verificado lê-se e verifica-se agora, no estudo; as decisões dele vão todas numa só pergunta. Passos à mão (manualSteps) só se forem reais na instalação.'
      : `. É o próprio servidor (o host Proxmox VE de ${update.hostServer?.name ?? 'servidor'}), não uma app: não há snapshot do host. ` +
        (update.hostPackages !== null
          ? `Não há versão nova do Proxmox VE: são ${update.hostPackages} pacotes do sistema (Debian) por atualizar. ` +
            'Segue as regras do servidor (os documentos dele vêm no fim deste pedido): o mapa do servidor, update_release_notes (a lista dos pacotes, de → para), ' +
            'quais são de segurança, se há kernel ou pacotes do Proxmox (pede reinício?), e no fim update_save_study. ' +
            'Decide: install (só com risco baixo: o MyHomeLab instala logo), recommend (a decisão é dele, em Waiting for reply) ou later. ' +
            'Sem passos à mão (manualSteps vazio): o que for preciso depois, como reiniciar, fica escrito no estudo.'
          : 'Segue as regras do servidor (os documentos dele vêm no fim deste pedido): o mapa do servidor, update_release_notes (o changelog do pve-manager), ' +
            'update_known_issues (o fórum e o bugzilla do Proxmox não se conseguem ler: se não vier nada, escreve "não se consegue ver"; não sobe o risco nem bloqueia, e não lhe pedes para ir lá ver), os pacotes por atualizar e se há kernel novo (pede reinício), e no fim update_save_study. ' +
            'Decide: install (só com risco baixo: o MyHomeLab instala logo), recommend (a decisão é dele, em Waiting for reply) ou later. Sem passos à mão (manualSteps vazio).')) +
    (update.component && update.account?.provider === 'NEXTCLOUD'
      ? ` É uma app DENTRO do Nextcloud (${update.componentTitle}, id ${update.component}): as notas e as issues são as do repositório dela (a ficha está em ${update.releaseUrl ?? 'https://apps.nextcloud.com'}); segue as regras do Nextcloud (as das apps lá dentro valem, as só do servidor não se aplicam). Instala-se com o occ na máquina do Nextcloud (occ app:update ${update.component}; num CT por pct exec, numa VM por qm guest exec), com snapshot antes, como a app. As apps instaladas veem-se com nextcloud_list_apps, sem comandos na máquina.`
      : '') +
    (update.component && update.account?.provider !== 'NEXTCLOUD'
      ? ` É uma peça DENTRO do Home Assistant (${COMPONENT_LABELS[update.componentGroup ?? 'other'] ?? 'peça'}: ${update.componentTitle}, entidade ${update.component}): as notas e as issues são as do repositório dela; vê também o resumo em ha_list_updates e o documento do Home Assistant. Não se instala com comandos no servidor: instala-se pelo próprio Home Assistant (update.install, com backup).`
      : '') +
    (update.account?.provider === 'NEXTCLOUD' && !update.component
      ? ' As apps dentro do Nextcloud têm atualizações próprias (uma por app): aqui é só o servidor; segue as regras do Nextcloud (as do servidor valem, as só das apps lá dentro não se aplicam). As apps instaladas e as que não têm versão para o Nextcloud novo vêm abaixo, lidas pelo MyHomeLab.'
      : '') +
    (update.account?.provider === 'HOME_ASSISTANT' && !update.component
      ? ' Vê também ha_list_updates e junta ao estudo uma secção à parte, "## Dentro do Home Assistant", com o que há por atualizar lá dentro por grupo (add-ons, repositórios do HACS, firmware, outras integrações) e o que aconselhas para cada grupo.'
      : '') +
    before +
    ' Durante o estudo não mudas nada: só lês e medes. Se decidires install, não instalas tu aqui: o MyHomeLab põe-na em Ready to update e a instalação começa a seguir.'
  );
}
