import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Email_Rule_Form_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../Inputs/Global_Dropdown/Global_Dropdown';
import { useEmailRule, type EmailRulePayload } from '../../../Hooks/EmailRule/useEmailRule';
import type {
  ConditionLogic,
  EmailRule,
  EmailRuleLabelPath,
  LabelMode,
  MailKind,
  MatchType,
} from '../../../Hooks/EmailRule/useEmailRules';

const CONDITION_LOGIC_VALUES = ['ALL', 'ANY'];

const MATCH_TYPE_VALUES = ['CONTAINS', 'EXACT', 'REGEX'];

const HAS_ATTACHMENT_VALUES = ['any', 'yes', 'no'];

const MAIL_KIND_VALUES = ['ANY', 'BULK', 'DIRECT'];

const INBOX_TIMING_VALUES = ['immediate', 'after_days'];

const LABEL_MODE_VALUES = ['ALL_LEVELS', 'LEAF_ONLY'];

interface Email_Rule_Form_Modal_Props {
  accountId: string;
  existingRule: EmailRule | null;
  onClose: () => void;
  onSaved: () => void;
  onSubmit?: (payload: EmailRulePayload) => Promise<boolean>;
}

type InboxRemovalTiming = 'immediate' | 'after_days';

const toCommaList = (values: string[]) => values.join(', ');
const fromCommaList = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const toDaysInput = (value: number | null) => (value === null || value === undefined ? '' : String(value));
const fromDaysInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

const emptyLabelPath = (): EmailRuleLabelPath => ({ path: '', labelMode: 'ALL_LEVELS' });

const Email_Rule_Form_Modal = ({ accountId, existingRule, onClose, onSaved, onSubmit }: Email_Rule_Form_Modal_Props) => {
  const { createEmailRule, updateEmailRule, loading } = useEmailRule(accountId);
  const { t } = useTranslation('email');

  const toOptions = (values: string[], group: string) =>
    values.map((value) => ({ value, label: t(`form.${group}.${value}`) }));

  const [name, setName] = useState(existingRule?.name ?? '');
  const [conditionLogic, setConditionLogic] = useState<ConditionLogic>(existingRule?.conditionLogic ?? 'ALL');
  const [fromContains, setFromContains] = useState(toCommaList(existingRule?.fromContains ?? []));
  const [subjectContains, setSubjectContains] = useState(toCommaList(existingRule?.subjectContains ?? []));
  const [keywords, setKeywords] = useState(toCommaList(existingRule?.keywords ?? []));
  const [excludeKeywords, setExcludeKeywords] = useState(toCommaList(existingRule?.excludeKeywords ?? []));
  const [matchType, setMatchType] = useState<MatchType>(existingRule?.matchType ?? 'CONTAINS');
  const [mailKind, setMailKind] = useState<MailKind>(existingRule?.mailKind ?? 'ANY');
  const [hasAttachment, setHasAttachment] = useState(
    existingRule?.hasAttachment === true ? 'yes' : existingRule?.hasAttachment === false ? 'no' : 'any',
  );

  const [markAsRead, setMarkAsRead] = useState(existingRule?.markAsRead ?? false);
  const [markAsImportant, setMarkAsImportant] = useState(existingRule?.markAsImportant ?? false);
  const [markAsStarred, setMarkAsStarred] = useState(existingRule?.markAsStarred ?? false);
  const [stopProcessing, setStopProcessing] = useState(existingRule?.stopProcessing ?? false);

  const [removeFromInbox, setRemoveFromInbox] = useState(existingRule?.removeFromInbox ?? false);
  const [removeFromInboxTiming, setRemoveFromInboxTiming] = useState<InboxRemovalTiming>(
    existingRule?.removeFromInboxAfterDays != null ? 'after_days' : 'immediate',
  );
  const [removeFromInboxAfterDays, setRemoveFromInboxAfterDays] = useState(
    toDaysInput(existingRule?.removeFromInboxAfterDays ?? null),
  );
  const [removeOnlyIfRead, setRemoveOnlyIfRead] = useState(existingRule?.removeOnlyIfRead ?? false);
  const [markAsReadOnRemove, setMarkAsReadOnRemove] = useState(existingRule?.markAsReadOnRemove ?? false);

  const [starredExpiresAfterDays, setStarredExpiresAfterDays] = useState(
    toDaysInput(existingRule?.starredExpiresAfterDays ?? null),
  );
  const [importantExpiresAfterDays, setImportantExpiresAfterDays] = useState(
    toDaysInput(existingRule?.importantExpiresAfterDays ?? null),
  );
  const [importantExpiresOnStar, setImportantExpiresOnStar] = useState(existingRule?.importantExpiresOnStar ?? false);

  const [labelPaths, setLabelPaths] = useState<EmailRuleLabelPath[]>(
    existingRule?.labelPaths?.length ? existingRule.labelPaths : [emptyLabelPath()],
  );

  const updateLabelPath = (index: number, changes: Partial<EmailRuleLabelPath>) => {
    setLabelPaths((current) =>
      current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...changes } : entry)),
    );
  };

  const addLabelPath = () => setLabelPaths((current) => [...current, emptyLabelPath()]);

  const removeLabelPath = (index: number) =>
    setLabelPaths((current) => current.filter((_, entryIndex) => entryIndex !== index));

  const handleSave = async () => {
    const payload: EmailRulePayload = {
      name: name.trim() || undefined,
      conditionLogic,
      fromContains: fromCommaList(fromContains),
      subjectContains: fromCommaList(subjectContains),
      keywords: fromCommaList(keywords),
      excludeKeywords: fromCommaList(excludeKeywords),
      matchType,
      mailKind,
      hasAttachment: hasAttachment === 'any' ? undefined : hasAttachment === 'yes',
      markAsRead,
      markAsImportant,
      markAsStarred,
      stopProcessing,
      removeFromInbox,
      removeFromInboxAfterDays:
        removeFromInbox && removeFromInboxTiming === 'after_days' ? fromDaysInput(removeFromInboxAfterDays) : null,
      removeOnlyIfRead,
      markAsReadOnRemove,
      starredExpiresAfterDays: fromDaysInput(starredExpiresAfterDays),
      importantExpiresAfterDays: fromDaysInput(importantExpiresAfterDays),
      importantExpiresOnStar,
      labelPaths: labelPaths
        .map((entry) => ({ path: entry.path.trim(), labelMode: entry.labelMode }))
        .filter((entry) => entry.path.length > 0),
    };

    const success = onSubmit
      ? await onSubmit(payload)
      : existingRule
        ? await updateEmailRule(existingRule.id, payload)
        : await createEmailRule(payload);

    if (success) onSaved();
  };

  return (
    <div className="Email_Rule_Form_Modal_Overlay" onClick={onClose}>
      <div className="Email_Rule_Form_Modal" onClick={(e) => e.stopPropagation()}>
        <div className="Email_Rule_Form_Modal_Field">
          <label>{t('form.name')}</label>
          <Global_Input
            id="email-rule-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('form.namePlaceholder')}
          />
        </div>

        <div className="Email_Rule_Form_Modal_Columns">
          <div className="Email_Rule_Form_Modal_Column">
            <div className="Email_Rule_Form_Modal_Section">{t('form.sections.conditions')}</div>

            <div className="Email_Rule_Form_Modal_Field">
              <label>{t('form.from')}</label>
              <Global_Input
                id="email-rule-from"
                value={fromContains}
                onChange={(e) => setFromContains(e.target.value)}
                placeholder={t('form.fromPlaceholder')}
              />
            </div>

            <div className="Email_Rule_Form_Modal_Field">
              <label>{t('form.subject')}</label>
              <Global_Input
                id="email-rule-subject"
                value={subjectContains}
                onChange={(e) => setSubjectContains(e.target.value)}
                placeholder={t('form.subjectPlaceholder')}
              />
            </div>

            <div className="Email_Rule_Form_Modal_Field">
              <label>{t('form.keywords')}</label>
              <Global_Input
                id="email-rule-keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
              <span className="Email_Rule_Form_Modal_Hint">{t('form.keywordsHint')}</span>
            </div>

            <div className="Email_Rule_Form_Modal_Field">
              <label>{t('form.excludeKeywords')}</label>
              <Global_Input
                id="email-rule-exclude-keywords"
                value={excludeKeywords}
                onChange={(e) => setExcludeKeywords(e.target.value)}
              />
            </div>

            <div className="Email_Rule_Form_Modal_Row">
              <div className="Email_Rule_Form_Modal_Field">
                <label>{t('form.conditionLogic')}</label>
                <Global_Dropdown
                  value={conditionLogic}
                  options={toOptions(CONDITION_LOGIC_VALUES, 'conditionLogicOptions')}
                  onChange={(value) => setConditionLogic(value as ConditionLogic)}
                  searchable={false}
                />
              </div>

              <div className="Email_Rule_Form_Modal_Field">
                <label>{t('form.matchType')}</label>
                <Global_Dropdown
                  value={matchType}
                  options={toOptions(MATCH_TYPE_VALUES, 'matchTypeOptions')}
                  onChange={(value) => setMatchType(value as MatchType)}
                  searchable={false}
                />
              </div>
            </div>

            <div className="Email_Rule_Form_Modal_Field">
              <label>{t('form.mailKind')}</label>
              <Global_Dropdown
                value={mailKind}
                options={toOptions(MAIL_KIND_VALUES, 'mailKindOptions')}
                onChange={(value) => setMailKind(value as MailKind)}
                searchable={false}
              />
              <span className="Email_Rule_Form_Modal_Hint">{t('form.mailKindHint')}</span>
            </div>

            <div className="Email_Rule_Form_Modal_Field">
              <label>{t('form.hasAttachment')}</label>
              <Global_Dropdown
                value={hasAttachment}
                options={toOptions(HAS_ATTACHMENT_VALUES, 'hasAttachmentOptions')}
                onChange={setHasAttachment}
                searchable={false}
              />
            </div>
          </div>

          <div className="Email_Rule_Form_Modal_Column">
            <div className="Email_Rule_Form_Modal_Section">{t('form.sections.immediateActions')}</div>

            <div className="Email_Rule_Form_Modal_Checkboxes">
              <label>
                <input type="checkbox" checked={markAsRead} onChange={(e) => setMarkAsRead(e.target.checked)} />
                {t('form.markAsRead')}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={markAsImportant}
                  onChange={(e) => setMarkAsImportant(e.target.checked)}
                />
                {t('form.markAsImportant')}
              </label>
              <label>
                <input type="checkbox" checked={markAsStarred} onChange={(e) => setMarkAsStarred(e.target.checked)} />
                {t('form.markAsStarred')}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={stopProcessing}
                  onChange={(e) => setStopProcessing(e.target.checked)}
                />
                {t('form.stopProcessing')}
              </label>
            </div>

            <div className="Email_Rule_Form_Modal_Section">{t('form.sections.removeFromInbox')}</div>

            <label className="Email_Rule_Form_Modal_Inline_Checkbox">
              <input
                type="checkbox"
                checked={removeFromInbox}
                onChange={(e) => setRemoveFromInbox(e.target.checked)}
              />
              {t('form.removeFromInbox')}
            </label>

            {removeFromInbox && (
              <>
                <div className="Email_Rule_Form_Modal_Row">
                  <div className="Email_Rule_Form_Modal_Field">
                    <label>{t('form.inboxTiming')}</label>
                    <Global_Dropdown
                      value={removeFromInboxTiming}
                      options={toOptions(INBOX_TIMING_VALUES, 'inboxTimingOptions')}
                      onChange={(value) => setRemoveFromInboxTiming(value as InboxRemovalTiming)}
                      searchable={false}
                    />
                  </div>

                  {removeFromInboxTiming === 'after_days' && (
                    <div className="Email_Rule_Form_Modal_Field">
                      <label>{t('form.inboxDays')}</label>
                      <Global_Input
                        id="email-rule-inbox-days"
                        type="number"
                        value={removeFromInboxAfterDays}
                        onChange={(e) => setRemoveFromInboxAfterDays(e.target.value)}
                        placeholder={t('form.inboxDaysPlaceholder')}
                      />
                    </div>
                  )}
                </div>

                <label className="Email_Rule_Form_Modal_Inline_Checkbox">
                  <input
                    type="checkbox"
                    checked={removeOnlyIfRead}
                    onChange={(e) => setRemoveOnlyIfRead(e.target.checked)}
                  />
                  {t('form.removeOnlyIfRead')}
                </label>

                <label className="Email_Rule_Form_Modal_Inline_Checkbox">
                  <input
                    type="checkbox"
                    checked={markAsReadOnRemove}
                    onChange={(e) => setMarkAsReadOnRemove(e.target.checked)}
                    disabled={removeOnlyIfRead}
                  />
                  {t('form.markAsReadOnRemove')}
                </label>
              </>
            )}

            <div className="Email_Rule_Form_Modal_Section">{t('form.sections.expiration')}</div>

            <div className="Email_Rule_Form_Modal_Row">
              <div className="Email_Rule_Form_Modal_Field">
                <label>{t('form.starExpires')}</label>
                <Global_Input
                  id="email-rule-star-days"
                  type="number"
                  value={starredExpiresAfterDays}
                  onChange={(e) => setStarredExpiresAfterDays(e.target.value)}
                  placeholder={t('form.neverPlaceholder')}
                />
              </div>

              <div className="Email_Rule_Form_Modal_Field">
                <label>{t('form.importantExpires')}</label>
                <Global_Input
                  id="email-rule-important-days"
                  type="number"
                  value={importantExpiresAfterDays}
                  onChange={(e) => setImportantExpiresAfterDays(e.target.value)}
                  placeholder={t('form.neverPlaceholder')}
                />
              </div>
            </div>

            <label className="Email_Rule_Form_Modal_Inline_Checkbox">
              <input
                type="checkbox"
                checked={importantExpiresOnStar}
                onChange={(e) => setImportantExpiresOnStar(e.target.checked)}
              />
              {t('form.importantExpiresOnStar')}
            </label>
          </div>
        </div>

        <div className="Email_Rule_Form_Modal_Section">{t('form.sections.paths')}</div>

        <p className="Email_Rule_Form_Modal_Hint">{t('form.pathsHint')}</p>

        <div className="Email_Rule_Form_Modal_Paths">
          {labelPaths.map((entry, index) => (
            <div className="Email_Rule_Form_Modal_Path_Row" key={index}>
              <div className="Email_Rule_Form_Modal_Field">
                <label>{t('form.path', { number: index + 1 })}</label>
                <Global_Input
                  id={`email-rule-path-${index}`}
                  value={entry.path}
                  onChange={(e) => updateLabelPath(index, { path: e.target.value })}
                  placeholder={t('form.pathPlaceholder')}
                />
              </div>

              <div className="Email_Rule_Form_Modal_Field">
                <label>{t('form.pathMode')}</label>
                <Global_Dropdown
                  value={entry.labelMode}
                  options={toOptions(LABEL_MODE_VALUES, 'labelModeOptions')}
                  onChange={(value) => updateLabelPath(index, { labelMode: value as LabelMode })}
                  searchable={false}
                />
              </div>

              <button
                type="button"
                className="Email_Rule_Form_Modal_Path_Remove"
                onClick={() => removeLabelPath(index)}
                aria-label={t('form.removePath')}
              >
                ×
              </button>
            </div>
          ))}

          <button type="button" className="Email_Rule_Form_Modal_Path_Add" onClick={addLabelPath}>
            {t('form.addPath')}
          </button>
        </div>

        <div className="Email_Rule_Form_Modal_Actions">
          <button className="Cancel_Button" onClick={onClose} disabled={loading}>
            {t('common:actions.cancel')}
          </button>
          <button className="Save_Button" onClick={handleSave} disabled={loading}>
            {t('common:actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Email_Rule_Form_Modal;
