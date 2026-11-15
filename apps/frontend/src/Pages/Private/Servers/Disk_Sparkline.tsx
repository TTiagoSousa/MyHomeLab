import { useTranslation } from 'react-i18next';

const WIDTH = 90;
const HEIGHT = 22;

interface Disk_Sparkline_Props {
  points: (number | null)[];
}

const Disk_Sparkline = ({ points }: Disk_Sparkline_Props) => {
  const { t } = useTranslation('servers');
  const values = points.filter((value): value is number => value != null);

  if (values.length < 2) return <span className='Disks_sub'>{t('disks.fewDays', { count: values.length })}</span>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = WIDTH / (values.length - 1);
  const line = values
    .map((value, index) => `${(index * step).toFixed(1)},${(HEIGHT - 2 - ((value - min) / range) * (HEIGHT - 4)).toFixed(1)}`)
    .join(' ');

  return (
    <span className='Disks_sparkline' title={t('disks.sparklineTitle', { min, max, count: values.length })}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <polyline points={line} fill='none' strokeWidth='1.5' />
      </svg>
      <span className='Disks_sub mono'>{min}–{max} °C</span>
    </span>
  );
};

export default Disk_Sparkline;
