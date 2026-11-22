import { useTranslation } from 'react-i18next';
import type { EmailRule } from '../../../../Hooks/EmailRule/useEmailRules';
import { useEmailRule } from '../../../../Hooks/EmailRule/useEmailRule';
import type { RuleMatch, RuleSearchField } from './ruleSearch';
import Highlight_Text from './Highlight_Text';
import * as Icon from '../../../../Imports/icons';

interface Email_Rule_Row_Props {
  rule: EmailRule;
  hits: RuleMatch['hits'];
  terms: string[];
  field: RuleSearchField;
  accountLabel: string | null;
  onEdit: () => void;
  onChanged: () => void;
}

const Email_Rule_Row = ({ rule, hits, terms, field, accountLabel, onEdit, onChanged }: Email_Rule_Row_Props) => {
  const { t } = useTranslation('email');
  const { updateEmailRule, deleteEmailRule } = useEmailRule(rule.accountId);

  const toggleActive = async () => {
    if (await updateEmailRule(rule.id, { isActive: !rule.isActive }, true)) onChanged();
  };

  const remove = async () => {
    if (await deleteEmailRule(rule.id)) onChanged();
  };

  return (
    <div className='EmailRules_row'>
      <button className={`EmailRules_row_status${rule.isActive ? ' active' : ''}`} onClick={toggleActive}>
        {rule.isActive ? t('rules.active') : t('rules.inactive')}
      </button>

      <div className='EmailRules_row_info' role='button' tabIndex={0} onClick={onEdit} onKeyDown={(e) => e.key === 'Enter' && onEdit()}>
        <span className='EmailRules_row_name'>
          <Highlight_Text text={rule.name} terms={field === 'all' || field === 'name' ? terms : []} />
          {rule.mailKind !== 'ANY' && (
            <span className={`EmailRules_row_kind ${rule.mailKind.toLowerCase()}`}>
              {t(`rules.mailKindTag.${rule.mailKind}`)}
            </span>
          )}
          {accountLabel && <span className='EmailRules_row_account'>{accountLabel}</span>}
        </span>
        <span className='EmailRules_row_summary'>
          {rule.labelPaths.length > 0 ? (
            <Highlight_Text
              text={rule.labelPaths.map((entry) => entry.path).join('  •  ')}
              terms={field === 'all' || field === 'labels' ? terms : []}
            />
          ) : (
            t('rules.noPath')
          )}
        </span>
        {hits
          .filter((hit) => hit.field !== 'name' && hit.field !== 'labels')
          .map((hit) => (
            <span className='EmailRules_row_hit' key={hit.field}>
              <span className='EmailRules_row_hit_field'>{t(`search.fields.${hit.field}`)}</span>
              <Highlight_Text text={hit.values.join(', ')} terms={terms} />
            </span>
          ))}
      </div>

      <button className='EmailRules_row_edit' onClick={onEdit} aria-label={t('common:actions.edit')}>
        <Icon.Pencil />
      </button>

      <button className='EmailRules_row_delete' onClick={remove} aria-label={t('common:actions.delete')}>
        <Icon.Close />
      </button>
    </div>
  );
};

export default Email_Rule_Row;
