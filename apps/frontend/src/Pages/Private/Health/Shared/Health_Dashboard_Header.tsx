import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const PERIODS = [7, 30, 90, 0];

interface Health_Dashboard_Header_Props {
  title: string;
  days?: number;
  onDays?: (days: number) => void;
  action?: ReactNode;
  back?: { path: string; label: string };
}

const Health_Dashboard_Header = ({ title, days, onDays, action, back }: Health_Dashboard_Header_Props) => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();

  return (
    <header>
      <div className='Right_Side'>
        <button type='button' className='Health_back' onClick={() => navigate(back?.path ?? '/MyHomeLab/Health')}>
          ← {back?.label ?? t('page.title')}
        </button>
        <span>{title}</span>
      </div>

      <div className='Left_Side'>
        {action}
        {onDays && (
          <div className='Health_periods'>
            {PERIODS.map((period) => (
              <button
                key={period}
                type='button'
                className={period === days ? 'active' : ''}
                onClick={() => onDays(period)}
              >
                {t(`periods.${period}`)}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};

export default Health_Dashboard_Header;
