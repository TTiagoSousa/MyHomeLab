import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { RunFrequency } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { FREQUENCY_OPTIONS } from '../../../Constants/runFrequency';
import * as Icon from '../../../Imports/icons';
import Tooltip from '../../../Components/Tooltip/Tooltip';
import Page_Help from '../../../Components/Page_Help/Page_Help';
import './App_Tables.scss';

export const Frequency_Select = ({
  value,
  onChange,
  disabled,
}: {
  value: RunFrequency;
  onChange: (value: RunFrequency) => void;
  disabled?: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <div className='Apps_frequency'>
      <Global_Dropdown
        value={value}
        options={FREQUENCY_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
        onChange={(next) => onChange(next as RunFrequency)}
        disabled={disabled}
        searchable={false}
      />
    </div>
  );
};

interface Apps_Section_Props {
  id?: string;
  icon?: ReactNode;
  title: string;
  description: string;
  onAdd?: () => void;
  addLabel?: string;
  children: ReactNode;
}

export const Apps_Section = ({ id, icon, title, description, onAdd, addLabel, children }: Apps_Section_Props) => (
  <section className='Apps_section' id={id}>
    <header>
      <div className='Apps_section_title'>
        {icon ?? <Icon.World />}
        <div>
          <span>{title}</span>
          <p>{description}</p>
        </div>
      </div>

      {onAdd && (
        <button type='button' className='Apps_section_add' onClick={onAdd} aria-label={addLabel} title={addLabel}>
          <Icon.Plus />
        </button>
      )}
    </header>

    {children}
  </section>
);

interface Apps_Page_Props {
  title: string;
  actions?: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  children: ReactNode;
}

export const Apps_Page = ({ title, actions, onAdd, addLabel, children }: Apps_Page_Props) => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();

  return (
    <div className='Apps'>
      <header>
        <div className='Right_Side Apps_back_title'>
          <button type='button' className='Apps_back' onClick={() => navigate('/MyHomeLab/Apps')}>
            <Icon.Chevron />
            <span>{t('page.title')}</span>
          </button>
          <span>{title}</span>
        </div>

        {(actions || onAdd) && (
          <div className='Left_Side'>
            {actions}
            {onAdd && (
              <button type='button' className='Apps_add' onClick={onAdd}>
                <Icon.Plus />
                <span>{addLabel}</span>
              </button>
            )}
          </div>
        )}
      </header>

      <div className='Apps_list'>{children}</div>
    </div>
  );
};

interface Apps_Account_Card_Props {
  avatar: string;
  title: string;
  meta?: string;
  chips?: ReactNode;
  actions?: ReactNode;
  onOpen: () => void;
}

export const Apps_Account_Card = ({ avatar, title, meta, chips, actions, onOpen }: Apps_Account_Card_Props) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Apps_account Apps_account_card'>
      <div className='Apps_account_avatar'>{avatar.slice(0, 2).toUpperCase()}</div>

      <div className='Apps_account_info'>
        <span className='Apps_account_title'>{title}</span>
        {meta && <span className='Apps_account_meta'>{meta}</span>}
        {chips && <span className='Apps_account_chips'>{chips}</span>}
      </div>

      <div className='Apps_account_actions'>
        {actions}
        <button type='button' className='active' onClick={onOpen}>
          {t('apps.open')}
        </button>
      </div>
    </div>
  );
};

export const Apps_Empty_Card = ({ label, onAdd }: { label: string; onAdd: () => void }) => (
  <div className='Apps_account_card Apps_empty_card'>
    <button type='button' className='Apps_section_connect' onClick={onAdd}>
      <Icon.Plus />
      <span>{label}</span>
    </button>
  </div>
);

interface Apps_Detail_Header_Props {
  backTo: string;
  backLabel: string;
  title: string;
  actions?: ReactNode;
  helpTopic?: string;
}

export const Apps_Detail_Header = ({ backTo, backLabel, title, actions, helpTopic }: Apps_Detail_Header_Props) => {
  const navigate = useNavigate();

  return (
    <header>
      <div className='Right_Side Apps_back_title'>
        <button type='button' className='Apps_back' onClick={() => navigate(backTo)}>
          <Icon.Chevron />
          <span>{backLabel}</span>
        </button>
        <span>{title}</span>
        {helpTopic && <Page_Help topic={helpTopic} />}
      </div>

      {actions && <div className='Left_Side'>{actions}</div>}
    </header>
  );
};

export const Apps_Hint = ({ hint, children }: { hint?: ReactNode; children: ReactNode }) =>
  hint ? (
    <Tooltip text={hint}>
      <span className='Apps_hint'>{children}</span>
    </Tooltip>
  ) : (
    <>{children}</>
  );

interface Apps_Pager_Props {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}

export const Apps_Pager = ({ page, pages, onChange }: Apps_Pager_Props) => {
  const { t } = useTranslation('addons');
  if (pages < 2) return null;

  return (
    <div className='Apps_pager'>
      <button type='button' className='prev' onClick={() => onChange(page - 1)} disabled={page === 0} aria-label={t('apps.proxmox.previousPage')}>
        <Icon.Chevron />
      </button>
      <span>{t('apps.proxmox.page', { page: page + 1, pages })}</span>
      <button type='button' onClick={() => onChange(page + 1)} disabled={page === pages - 1} aria-label={t('apps.proxmox.nextPage')}>
        <Icon.Chevron />
      </button>
    </div>
  );
};
