import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LabParameter, LabReportSummary } from '../../../../Hooks/Health/healthTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay } from '../Shared/healthFormat';
import { formatLabValue, labName } from './labFormat';

interface Lab_Summary_Card_Props {
  reports: LabReportSummary[];
  parameters: LabParameter[];
  onOpen: (key: string) => void;
}

const Lab_Summary_Card = ({ reports, parameters, onOpen }: Lab_Summary_Card_Props) => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();
  const latest = reports[0];
  const counted = parameters.filter((parameter) => !parameter.key.endsWith('_pct'));
  const flagged = counted.filter((parameter) => parameter.flag);
  const inRange = counted.length - flagged.length;

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('labs.summary.title')}</span>
          <p className='Health_card_description'>
            {t('labs.summary.latest', { date: formatDay(latest.collectedAt), lab: latest.lab ?? t('labs.unknownLab') })}
          </p>
        </div>
        <button type='button' className='Health_see_all' onClick={() => navigate(`/MyHomeLab/Health/Labs/${latest.id}`)}>
          {t('labs.summary.openReport')}
        </button>
      </div>

      <div className='Health_Stats columns-4'>
        <Health_Stat highlight label={t('labs.summary.parameters')} value={String(counted.length)} />
        <Health_Stat
          label={t('labs.summary.inRange')}
          value={String(inRange)}
          sub={counted.length ? t('labs.summary.inRangeSub', { percent: Math.round((inRange / counted.length) * 100) }) : undefined}
        />
        <Health_Stat label={t('labs.summary.outOfRange')} value={String(flagged.length)} />
        <Health_Stat label={t('labs.summary.reports')} value={String(reports.length)} />
      </div>

      {flagged.length ? (
        <div className='Lab_Attention'>
          <span>{t('labs.summary.attention')}</span>
          {flagged.map((parameter) => (
            <button key={parameter.key} type='button' className='Lab_Chip' onClick={() => onOpen(parameter.key)}>
              <strong>{labName(t, parameter)}</strong>
              {formatLabValue(parameter)}
              <small>{t(`labs.flags.${parameter.flag}`)}</small>
            </button>
          ))}
        </div>
      ) : (
        <p className='Lab_All_Good'>{t('labs.summary.allGood')}</p>
      )}
    </section>
  );
};

export default Lab_Summary_Card;
