import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSchedules } from '../../../Hooks/Schedules/useSchedules';
import { scheduleState } from '../../../Components/Schedule_Card/scheduleFormat';
import Schedule_Modal from '../../../Components/Modals/Schedule_Modal/Schedule_Modal';
import Schedules_Filters from './Schedules_Filters';
import Schedules_Table from './Schedules_Table';
import * as Icon from '../../../Imports/icons';
import '../../../Components/Linked_Docs/Linked_Docs.scss';
import './Schedules_View.scss';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

interface Schedules_View_Props {
  creating: boolean;
  onCreate: () => void;
  onCloseCreate: () => void;
}

const Schedules_View = ({ creating, onCreate, onCloseCreate }: Schedules_View_Props) => {
  const { t } = useTranslation('schedules');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { schedules, agents, loading, saving, error, saveSchedule, runSchedule } = useSchedules();

  const search = searchParams.get('sq') ?? '';
  const state = searchParams.get('sstate') ?? '';
  const agent = searchParams.get('sagent') ?? '';
  const tag = searchParams.get('stag') ?? '';
  const page = Math.max(0, Number(searchParams.get('spage') ?? 1) - 1);
  const [searchText, setSearchText] = useState(search);

  const setFilter = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'spage') next.delete('spage');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText.trim() !== search) setFilter('sq', searchText.trim());
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const tags = [...new Set(schedules.flatMap((schedule) => schedule.tags))].sort();
  const words = search.toLowerCase();
  const filtered = schedules.filter(
    (schedule) =>
      (!state || scheduleState(schedule) === state) &&
      (!agent || schedule.agentKey === agent) &&
      (!tag || schedule.tags.includes(tag)) &&
      (!words || `${schedule.title} ${schedule.instruction} ${schedule.targetLabel ?? ''}`.toLowerCase().includes(words)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const goToPage = (value: number) => setFilter('spage', value > 0 ? String(value + 1) : '');

  return (
    <div className='Schedules_View'>
      <p className='Schedules_intro'>{t('intro')}</p>

      {loading && <p className='Schedules_note'>{t('loading')}</p>}
      {!loading && error && <p className='Schedules_note error'>{error}</p>}
      {!loading && !error && schedules.length === 0 && (
        <div className='Schedules_empty'>
          <span>{t('empty.title')}</span>
          <p>{t('empty.text')}</p>
          <button type='button' className='Schedules_new' onClick={() => onCreate()}>
            <Icon.Plus />
            <span>{t('actions.new')}</span>
          </button>
        </div>
      )}

      {!loading && !error && schedules.length > 0 && (
        <section className='Schedules_panel'>
          <Schedules_Filters
            search={searchText}
            state={state}
            agent={agent}
            tag={tag}
            agents={agents}
            tags={tags}
            onSearch={setSearchText}
            onState={(value) => setFilter('sstate', value)}
            onAgent={(value) => setFilter('sagent', value)}
            onTag={(value) => setFilter('stag', value)}
          />

          <span className='Schedules_label'>{t('list.count', { count: filtered.length })}</span>

          {filtered.length === 0 ? (
            <p className='Schedules_note'>{t('list.noResults')}</p>
          ) : (
            <Schedules_Table
              schedules={visible}
              agents={agents}
              onRun={(schedule) => void runSchedule(schedule.id)}
              onOpen={(schedule) => navigate(`/MyHomeLab/Schedules/${schedule.id}`)}
            />
          )}

          {pages > 1 && (
            <div className='Linked_Docs_Pager Schedules_pager'>
              <button type='button' className='prev' onClick={() => goToPage(current - 1)} disabled={current === 0} aria-label={t('list.previous')}>
                <Icon.Chevron />
              </button>
              <span>{t('list.page', { page: current + 1, pages })}</span>
              <button type='button' onClick={() => goToPage(current + 1)} disabled={current === pages - 1} aria-label={t('list.next')}>
                <Icon.Chevron />
              </button>
            </div>
          )}
        </section>
      )}

      {creating && (
        <Schedule_Modal
          existing={null}
          agents={agents}
          link={null}
          saving={saving}
          onSave={(payload) => saveSchedule(payload)}
          onClose={onCloseCreate}
        />
      )}
    </div>
  );
};

export default Schedules_View;
