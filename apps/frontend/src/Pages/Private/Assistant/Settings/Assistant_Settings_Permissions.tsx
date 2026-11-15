import { useTranslation } from 'react-i18next';
import {
  ASSISTANT_PERMISSION_AREAS,
  ASSISTANT_PERMISSION_KEYS,
  assistantPermissionKey,
  type AssistantPermissionGroup,
} from '@myhomelab/shared';
import { useAssistantPermissions } from '../../../../Hooks/Agent/useAssistantPermissions';
import { matchesSearch } from './assistantSettingsSearch';

const GROUPS: AssistantPermissionGroup[] = ['email', 'organization', 'health', 'servers', 'development', 'home', 'assistant'];

interface Assistant_Settings_Permissions_Props {
  query: string;
}

const Assistant_Settings_Permissions = ({ query }: Assistant_Settings_Permissions_Props) => {
  const { t } = useTranslation('assistant');
  const { denied, loading, saving, setAllowed } = useAssistantPermissions();

  const areaMatches = (key: string, group: AssistantPermissionGroup) =>
    matchesSearch(query, [
      t(`settings.permissions.areas.${key}.name`),
      t(`settings.permissions.areas.${key}.description`),
      t(`settings.permissions.groups.${group}`),
    ]);

  const allAllowed = denied.length === 0;

  return (
    <div className='Settings_section Assistant_Settings_Permissions'>
      <div className='Assistant_Settings_Permissions_head'>
        <div>
          <div className='Settings_section_title'>{t('settings.permissions.title')}</div>
          <p className='Settings_section_description'>{t('settings.permissions.description')}</p>
          <p className='Settings_section_description'>{t('settings.permissions.layers')}</p>
        </div>

        <button
          type='button'
          className='Assistant_Settings_Permissions_all'
          disabled={loading || saving}
          onClick={() => setAllowed([...ASSISTANT_PERMISSION_KEYS], !allAllowed)}
        >
          {allAllowed ? t('settings.permissions.allOff') : t('settings.permissions.allOn')}
        </button>
      </div>

      {GROUPS.map((group) => {
        const areas = ASSISTANT_PERMISSION_AREAS.filter((area) => area.group === group && areaMatches(area.key, group));
        if (!areas.length) return null;

        return (
          <div className='Assistant_Settings_Permissions_group' key={group}>
            <span className='Assistant_Settings_Permissions_group_title'>{t(`settings.permissions.groups.${group}`)}</span>

            {areas.map((area) => (
              <div className='Assistant_Settings_Permissions_row' key={area.key}>
                <div className='Assistant_Settings_Permissions_text'>
                  <span className='Assistant_Settings_Permissions_name'>{t(`settings.permissions.areas.${area.key}.name`)}</span>
                  <span className='Assistant_Settings_Permissions_description'>
                    {t(`settings.permissions.areas.${area.key}.description`)}
                  </span>
                </div>

                <div className='Assistant_Settings_Permissions_access'>
                  {area.access.map((access) => {
                    const key = assistantPermissionKey(area.key, access);
                    const allowed = !denied.includes(key);
                    return (
                      <button
                        key={access}
                        type='button'
                        className={allowed ? 'active' : ''}
                        aria-pressed={allowed}
                        disabled={loading}
                        onClick={() => setAllowed([key], !allowed)}
                      >
                        {t(`settings.permissions.${access}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {group === 'health' && <p className='Assistant_Settings_Permissions_note'>{t('settings.permissions.healthNote')}</p>}
          </div>
        );
      })}
    </div>
  );
};

export default Assistant_Settings_Permissions;
