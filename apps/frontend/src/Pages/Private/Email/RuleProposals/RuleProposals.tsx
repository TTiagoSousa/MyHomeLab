import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../EmailRules/EmailRules.scss';
import './RuleProposals.scss';
import { useRuleProposals, type RuleProposal } from '../../../../Hooks/EmailRule/useRuleProposals';
import Email_Rule_Form_Modal from '../../../../Components/Modals/Email_Rule_Form_Modal/Email_Rule_Form_Modal';
import { dateLocale } from '../../../../i18n';
import Rule_Proposal_Row from './Rule_Proposal_Row';
import { proposalToRule } from './proposalToRule';

const formatDate = (date: string | null) =>
  date ? new Date(date).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

const RuleProposals = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('email');
  const { pending, recent, lastAnalysisAt, loading, busy, analyze, implementAll, implement, dismiss, restore, updateProposal } =
    useRuleProposals(accountId ?? null);
  const [editing, setEditing] = useState<RuleProposal | null>(null);
  const [showRecent, setShowRecent] = useState(false);

  if (!accountId) return null;

  const lastAnalysis = formatDate(lastAnalysisAt);

  return (
    <div className='EmailRules RuleProposals'>
      <header>
        <div className='Right_Side'>
          <button className='EmailRules_back' onClick={() => navigate(`/MyHomeLab/Apps/Gmail/${accountId}`)}>
            {t('rules.back')}
          </button>
          <span>{t('proposals.title')}</span>
        </div>

        <div className='Left_Side'>
          <button className='EmailRules_run' disabled={busy !== null} onClick={analyze}>
            {busy === 'analyze' ? t('proposals.analyzing') : t('proposals.analyzeNow')}
          </button>
          <button className='EmailRules_add' disabled={busy !== null || pending.length === 0} onClick={implementAll}>
            <span>{t('proposals.implementAll', { count: pending.length })}</span>
          </button>
        </div>
      </header>

      <p className='RuleProposals_intro'>
        {t('proposals.intro')}{' '}
        {lastAnalysis ? t('proposals.lastAnalysis', { date: lastAnalysis }) : t('proposals.neverAnalyzed')}
      </p>

      <div className='EmailRules_list'>
        {!loading && pending.length === 0 && <div className='EmailRules_empty'>{t('proposals.empty')}</div>}

        {pending.map((proposal) => (
          <Rule_Proposal_Row
            key={proposal.id}
            proposal={proposal}
            busy={busy !== null}
            onImplement={() => implement(proposal.id)}
            onEdit={() => setEditing(proposal)}
            onDismiss={() => dismiss(proposal.id)}
          />
        ))}
      </div>

      {recent.length > 0 && (
        <div className='RuleProposals_recent'>
          <button type='button' className='RuleProposals_recent_toggle' onClick={() => setShowRecent(!showRecent)}>
            {showRecent ? '▾' : '▸'} {t('proposals.recent', { count: recent.length })}
          </button>
          {showRecent && (
            <div className='EmailRules_list'>
              {recent.map((proposal) => (
                <Rule_Proposal_Row
                  key={proposal.id}
                  proposal={proposal}
                  busy={busy !== null}
                  onRestore={proposal.status === 'DISMISSED' ? () => restore(proposal.id) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <Email_Rule_Form_Modal
          accountId={accountId}
          existingRule={proposalToRule(editing, accountId)}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
          onSubmit={(payload) => updateProposal(editing.id, payload)}
        />
      )}
    </div>
  );
};

export default RuleProposals;
