import { useTranslation } from 'react-i18next';
import type { ServerDisk } from '../../../Hooks/Servers/useServerDisks';
import { dateLocale } from '../../../i18n';
import { formatBytes } from './format';
import Disk_Sparkline from './Disk_Sparkline';

const formatCount = (value: number | null) => (value == null ? '—' : value.toLocaleString(dateLocale()));

const growthOf = (disk: ServerDisk, field: 'reallocated' | 'pending') => {
  const values = disk.history.map((point) => point[field]).filter((value): value is number => value != null);
  if (values.length < 2) return 0;
  return values[values.length - 1] - Math.min(...values);
};

interface Disk_Row_Props {
  disk: ServerDisk;
}

const Disk_Row = ({ disk }: Disk_Row_Props) => {
  const { t } = useTranslation('servers');
  const reallocatedGrowth = growthOf(disk, 'reallocated');
  const pendingGrowth = growthOf(disk, 'pending');

  return (
    <tr className={`Disks_row ${disk.status}`}>
      <td>
        <span className='Servers_guest_name'>{disk.model ?? disk.devPath}</span>
        {disk.type && <span className='Servers_tag'>{disk.type}</span>}
        <span className='Disks_sub mono'>
          {disk.devPath} · {formatBytes(disk.sizeBytes, 0)}
        </span>
        {disk.issues.map((issue) => (
          <span key={issue.text} className={`Disks_issue ${issue.level}`}>{issue.text}</span>
        ))}
      </td>
      <td>
        <i className={`Disks_dot ${disk.status}`} />
        {disk.health ?? t('disks.noSmart')}
      </td>
      <td className='mono'>{disk.wearout == null ? '—' : `${disk.wearout}%`}</td>
      <td className='mono'>{disk.temperature == null ? '—' : `${disk.temperature} °C`}</td>
      <td className='mono'>
        {formatCount(disk.reallocated)}
        {reallocatedGrowth > 0 && <span className='Disks_growth'> +{reallocatedGrowth}</span>}
      </td>
      <td className='mono'>
        {formatCount(disk.pending)}
        {pendingGrowth > 0 && <span className='Disks_growth'> +{pendingGrowth}</span>}
      </td>
      <td className='mono'>{formatCount(disk.powerOnHours)}</td>
      <td>
        <Disk_Sparkline points={disk.history.map((point) => point.temperature)} />
      </td>
    </tr>
  );
};

export default Disk_Row;
