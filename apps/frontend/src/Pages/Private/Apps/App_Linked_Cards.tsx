import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './App_Linked_Cards.scss';
import { useAgentAccess } from '../../../Hooks/Agent/useAgentAccess';
import { useLinkedDocs } from '../../../Hooks/Docs/useLinkedDocs';
import { useSchedules } from '../../../Hooks/Schedules/useSchedules';
import { scheduleWhen } from '../../../Components/Schedule_Card/scheduleFormat';
import Tooltip from '../../../Components/Tooltip/Tooltip';
import * as Icon from '../../../Imports/icons';

export type App_Linked_Panel = 'agents' | 'docs' | 'schedules';

const HINT_LIMIT = 6;

interface Linked_Card_Props {
  id: App_Linked_Panel;
  icon: ComponentType;
  title: string;
  count: number | null;
  detail: string;
  names: string[];
  emptyHint: string;
  onOpen: (panel: App_Linked_Panel) => void;
}

const Linked_Card = ({ id, icon: CardIcon, title, count, detail, names, emptyHint, onOpen }: Linked_Card_Props) => {
  const { t } = useTranslation('addons');

  const hint: ReactNode = names.length ? (
    <>
      {names.slice(0, HINT_LIMIT).map((name) => (
        <span key={name} className='App_Summary_Line'>
          · {name}
        </span>
      ))}
      {names.length > HINT_LIMIT && <span className='App_Summary_Line'>{t('apps.linked.more', { count: names.length - HINT_LIMIT })}</span>}
    </>
  ) : (
    emptyHint
  );

  return (
    <Tooltip text={hint}>
      <button type='button' className='App_Linked_Card' id={`app-${id}`} onClick={() => onOpen(id)}>
        <CardIcon />
        <span className='App_Linked_Card_Text'>
          <span className='App_Linked_Card_Title'>{title}</span>
          <span className='App_Linked_Card_Detail'>{detail}</span>
        </span>
        <span className={`App_Linked_Card_Count${count ? ' has' : ''}`}>{count ?? '…'}</span>
      </button>
    </Tooltip>
  );
};

interface App_Linked_Cards_Props {
  type: 'APP' | 'SERVER';
  targetId: string;
  onOpen: (panel: App_Linked_Panel) => void;
}

const App_Linked_Cards = ({ type, targetId, onOpen }: App_Linked_Cards_Props) => {
  const { t } = useTranslation(['addons', 'schedules']);
  const { rows, loading: loadingAgents } = useAgentAccess(type, targetId);
  const { docs, loading: loadingDocs } = useLinkedDocs(type, targetId);
  const { schedules, loading: loadingSchedules } = useSchedules({ linkType: type, targetId });

  const agents = rows.filter((row) => row.canRead);
  const writers = agents.filter((row) => row.canWrite && row.level !== 'READ' && row.level !== 'NONE').length;
  const rules = docs.filter((doc) => doc.kind === 'RULES').length;
  const active = schedules.filter((schedule) => schedule.enabled).length;

  return (
    <div className='App_Linked_Cards'>
      <Linked_Card
        id='agents'
        icon={Icon.Agents}
        title={t('apps.linked.agents')}
        count={loadingAgents ? null : agents.length}
        detail={agents.length ? t('apps.linked.agentsDetail', { write: writers }) : t('apps.linked.agentsEmpty')}
        names={agents.map((row) => row.name)}
        emptyHint={t('apps.linked.agentsHint')}
        onOpen={onOpen}
      />
      <Linked_Card
        id='docs'
        icon={Icon.Doc}
        title={t('apps.linked.docs')}
        count={loadingDocs ? null : docs.length}
        detail={docs.length ? t('apps.linked.docsDetail', { count: rules }) : t('apps.linked.docsEmpty')}
        names={docs.map((doc) => doc.title)}
        emptyHint={t('apps.linked.docsHint')}
        onOpen={onOpen}
      />
      <Linked_Card
        id='schedules'
        icon={Icon.Clock}
        title={t('apps.linked.schedules')}
        count={loadingSchedules ? null : schedules.length}
        detail={schedules.length ? t('apps.linked.schedulesDetail', { count: active }) : t('apps.linked.schedulesEmpty')}
        names={schedules.map((schedule) => `${schedule.title} — ${scheduleWhen(schedule, t)}`)}
        emptyHint={t('apps.linked.schedulesHint')}
        onOpen={onOpen}
      />
    </div>
  );
};

export default App_Linked_Cards;
