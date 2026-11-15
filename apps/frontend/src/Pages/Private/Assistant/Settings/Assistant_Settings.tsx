import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ASSISTANT_PERMISSION_AREAS } from '@myhomelab/shared';
import '../../Settings/Settings.scss';
import './Assistant_Settings.scss';
import {
  ASSISTANT_SETTINGS_SECTIONS,
  type AssistantSettingsSection,
} from '../../../../Constants/assistantSettings';
import Settings_Ai from '../../Settings/Settings_Ai';
import Assistant_Settings_Permissions from './Assistant_Settings_Permissions';
import { matchesSearch } from './assistantSettingsSearch';
import * as Icon from '../../../../Imports/icons';

const isSection = (value: string | null): value is AssistantSettingsSection =>
  ASSISTANT_SETTINGS_SECTIONS.some((section) => section.id === value);

const Assistant_Settings = () => {
  const { t } = useTranslation(['assistant', 'settings']);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');

  const requested = params.get('section');
  const active: AssistantSettingsSection = isSection(requested) ? requested : 'ai';

  const ownTerms = (id: AssistantSettingsSection) => [
    t(`settings.sections.${id}`),
    t(`settings.hints.${id}`),
    ...(id === 'ai' ? [t('settings:ai.title'), t('settings:ai.description')] : []),
    ...(id === 'permissions' ? [t('settings.permissions.title'), t('settings.permissions.description')] : []),
  ];

  const ownMatch = (id: AssistantSettingsSection) => matchesSearch(query, ownTerms(id));

  const sectionMatches = (id: AssistantSettingsSection) =>
    ownMatch(id) || (id === 'permissions' && ASSISTANT_PERMISSION_AREAS.some((area) =>
      matchesSearch(query, [
        t(`settings.permissions.areas.${area.key}.name`),
        t(`settings.permissions.areas.${area.key}.description`),
        t(`settings.permissions.groups.${area.group}`),
      ]),
    ));

  const searching = query.trim().length > 0;
  const visible = searching
    ? ASSISTANT_SETTINGS_SECTIONS.filter((section) => sectionMatches(section.id)).map((section) => section.id)
    : [active];

  const open = (id: AssistantSettingsSection) => {
    setQuery('');
    setParams({ section: id });
  };

  const renderSection = (id: AssistantSettingsSection) => {
    if (id === 'ai') return <Settings_Ai key={id} />;
    return <Assistant_Settings_Permissions key={id} query={ownMatch('permissions') ? '' : query} />;
  };

  return (
    <div className='Settings Assistant_Settings'>
      <header>
        <div className='Right_Side'>
          <button type='button' className='Assistant_Settings_back' onClick={() => navigate('/MyHomeLab/Assistant')}>
            <Icon.Chevron />
            <span>{t('settings.back')}</span>
          </button>
          <span>{t('settings.title')}</span>
        </div>
      </header>

      <label className='Assistant_Settings_search'>
        <Icon.Search />
        <input
          type='search'
          value={query}
          placeholder={t('settings.search')}
          aria-label={t('settings.search')}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className='Assistant_Settings_layout'>
        <nav className='Assistant_Settings_nav'>
          {ASSISTANT_SETTINGS_SECTIONS.map(({ id, icon: SectionIcon }) => (
            <button
              key={id}
              type='button'
              className={`${!searching && id === active ? 'active' : ''}${searching && !visible.includes(id) ? ' dim' : ''}`}
              onClick={() => open(id)}
            >
              <SectionIcon />
              <span className='Assistant_Settings_nav_text'>
                <span className='Assistant_Settings_nav_name'>{t(`settings.sections.${id}`)}</span>
                <span className='Assistant_Settings_nav_hint'>{t(`settings.hints.${id}`)}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className='Assistant_Settings_content'>
          {visible.map(renderSection)}
          {searching && !visible.length && (
            <p className='Assistant_Settings_empty'>{t('settings.noResults', { query: query.trim() })}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Assistant_Settings;
