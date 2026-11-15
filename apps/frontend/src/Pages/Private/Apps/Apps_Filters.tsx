import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import * as Icon from '../../../Imports/icons';

export type Hosting_Filter = '' | 'selfHosted' | 'cloud' | 'both';
export type Connection_Filter = '' | 'connected' | 'notConnected';

const HOSTING_FILTERS: Hosting_Filter[] = ['selfHosted', 'cloud', 'both'];
const CONNECTION_FILTERS: Connection_Filter[] = ['connected', 'notConnected'];

interface Apps_Filters_Props {
  search: string;
  hosting: Hosting_Filter;
  connection: Connection_Filter;
  onSearch: (value: string) => void;
  onHosting: (value: Hosting_Filter) => void;
  onConnection: (value: Connection_Filter) => void;
}

const Apps_Filters = ({ search, hosting, connection, onSearch, onHosting, onConnection }: Apps_Filters_Props) => {
  const { t } = useTranslation('addons');

  const hostingOptions = [{ value: '', label: t('page.filters.allHosting') }, ...HOSTING_FILTERS.map((value) => ({ value, label: t(`page.filters.hosting.${value}`) }))];
  const connectionOptions = [
    { value: '', label: t('page.filters.allStates') },
    ...CONNECTION_FILTERS.map((value) => ({ value, label: t(`page.filters.connection.${value}`) })),
  ];

  return (
    <div className='Apps_filters'>
      <label className='Apps_search'>
        <Icon.Search />
        <input type='search' value={search} placeholder={t('page.filters.search')} aria-label={t('page.filters.search')} onChange={(e) => onSearch(e.target.value)} />
      </label>
      <Global_Dropdown value={hosting} options={hostingOptions} onChange={(value) => onHosting(value as Hosting_Filter)} searchable={false} />
      <Global_Dropdown value={connection} options={connectionOptions} onChange={(value) => onConnection(value as Connection_Filter)} searchable={false} />
    </div>
  );
};

export default Apps_Filters;
