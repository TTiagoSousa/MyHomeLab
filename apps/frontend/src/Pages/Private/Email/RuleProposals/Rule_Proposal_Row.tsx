import { useTranslation } from 'react-i18next';
import type { RuleProposal } from '../../../../Hooks/EmailRule/useRuleProposals';
import { dateLocale } from '../../../../i18n';
import * as Icon from '../../../../Imports/icons';

const formatDate = (date: string) =>
  new Date(date).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

interface Rule_Proposal_Row_Props {
  proposal: RuleProposal;
  busy: boolean;
  onImplement?: () => void;
  onEdit?: () => void;
  onDismiss?: () => void;
  onRestore?: () => void;
}

const Rule_Proposal_Row = ({ proposal, busy, onImplement, onEdit, onDismiss, onRestore }: Rule_Proposal_Row_Props) => {
  const { t } = useTranslation('email');
  const { rule, evidence } = proposal;

  const conditions = [
    rule.fromContains?.length ? t('proposals.conditions.from', { values: rule.fromContains.join(', ') }) : null,
    rule.subjectContains?.length ? t('proposals.conditions.subject', { values: rule.subjectContains.join(', ') }) : null,
    rule.keywords?.length ? t('proposals.conditions.keywords', { values: rule.keywords.join(', ') }) : null,
    rule.mailKind && rule.mailKind !== 'ANY' ? t(`rules.mailKindTag.${rule.mailKind}`) : null,
  ].filter(Boolean);

  const afterDays = rule.removeFromInboxAfterDays ?? null;
  const actions = [
    ...(rule.labelPaths ?? []).map((entry) => t('proposals.actions.label', { path: entry.path })),
    rule.markAsRead ? t('proposals.actions.markAsRead') : null,
    rule.markAsImportant ? t('proposals.actions.markAsImportant') : null,
    rule.markAsStarred ? t('proposals.actions.markAsStarred') : null,
    rule.removeFromInbox
      ? afterDays != null
        ? t('proposals.actions.archiveAfter', { count: afterDays })
        : t('proposals.actions.archiveNow')
      : null,
    rule.removeFromInbox && rule.removeOnlyIfRead ? t('proposals.actions.onlyIfRead') : null,
    rule.markAsReadOnRemove ? t('proposals.actions.readOnArchive') : null,
    rule.starredExpiresAfterDays != null ? t('proposals.actions.starExpires', { count: rule.starredExpiresAfterDays }) : null,
    rule.importantExpiresAfterDays != null ? t('proposals.actions.importantExpires', { count: rule.importantExpiresAfterDays }) : null,
    rule.stopProcessing ? t('proposals.actions.stop') : null,
  ].filter(Boolean);

  return (
    <div className='EmailRules_row RuleProposals_row'>
      {proposal.status === 'PENDING' ? (
        <span className='RuleProposals_tag'>{proposal.userEdited ? t('proposals.edited') : t('proposals.tag')}</span>
      ) : (
        <span className={`RuleProposals_status ${proposal.status.toLowerCase()}`}>{t(`proposals.status.${proposal.status}`)}</span>
      )}

      <div className='EmailRules_row_info' onClick={onEdit}>
        <span className='EmailRules_row_name'>{rule.name || t('proposals.unnamed')}</span>
        <span className='RuleProposals_reason'>{proposal.reason}</span>
        <span className='EmailRules_row_summary'>
          {t('proposals.when')}: {conditions.join(' · ') || '—'}
        </span>
        <span className='EmailRules_row_summary'>
          {t('proposals.does')}: {actions.join(' · ') || '—'}
        </span>
        {evidence && (
          <span className='RuleProposals_evidence'>
            {t('proposals.evidence', { emails: evidence.emails, unread: evidence.unread, bulk: evidence.bulk })}
          </span>
        )}
        {proposal.decidedAt && proposal.status !== 'PENDING' && (
          <span className='RuleProposals_auto'>{t('proposals.decidedAt', { date: formatDate(proposal.decidedAt) })}</span>
        )}
        {proposal.autoImplementAt && (
          <span className='RuleProposals_auto'>{t('proposals.autoAt', { date: formatDate(proposal.autoImplementAt) })}</span>
        )}
      </div>

      {onRestore && (
        <button className='RuleProposals_implement' onClick={onRestore} disabled={busy}>
          {t('proposals.restore')}
        </button>
      )}

      {onImplement && (
        <button className='RuleProposals_implement' onClick={onImplement} disabled={busy}>
          {t('proposals.implement')}
        </button>
      )}

      {onEdit && (
        <button className='EmailRules_row_edit' onClick={onEdit} disabled={busy} title={t('proposals.edit')}>
          <Icon.Pencil />
        </button>
      )}

      {onDismiss && (
        <button className='EmailRules_row_delete' onClick={onDismiss} disabled={busy} title={t('proposals.dismiss')}>
          <Icon.Close />
        </button>
      )}
    </div>
  );
};

export default Rule_Proposal_Row;
