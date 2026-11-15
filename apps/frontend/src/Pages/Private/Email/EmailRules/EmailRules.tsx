import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './EmailRules.scss';
import type { EmailRule } from '../../../../Hooks/EmailRule/useEmailRules';
import { useAllEmailRules } from '../../../../Hooks/EmailRule/useAllEmailRules';
import { useEmailRule } from '../../../../Hooks/EmailRule/useEmailRule';
import { useConnectedAccounts } from '../../../../Hooks/ConnectedAccount/useConnectedAccounts';
import Email_Rule_Form_Modal from '../../../../Components/Modals/Email_Rule_Form_Modal/Email_Rule_Form_Modal';
import * as Icon from '../../../../Imports/icons';
import {
  RULE_SEARCH_FIELDS,
  RULE_STATUS_FILTERS,
  searchRules,
  searchTerms,
  type RuleSearchField,
  type RuleStatusFilter,
} from './ruleSearch';
import Email_Rule_Row from './Email_Rule_Row';

const EmailRules = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('email');
  const [params, setParams] = useSearchParams();
  const { connectedAccounts } = useConnectedAccounts('GMAIL');
  const { emailRules, fetchEmailRules } = useAllEmailRules(connectedAccounts.map((account) => account.id));

  const requested = params.get('account');
  const account =
    connectedAccounts.find((item) => item.id === requested) ??
    (connectedAccounts.length === 1 ? connectedAccounts[0] : null);
  const { runEmailRules, loading } = useEmailRule(account?.id ?? '');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EmailRule | null>(null);
  const [query, setQuery] = useState('');
  const [field, setField] = useState<RuleSearchField>('all');
  const [status, setStatus] = useState<RuleStatusFilter>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  const accountRules = account ? emailRules.filter((rule) => rule.accountId === account.id) : emailRules;
  const matches = searchRules(accountRules, query, field, status);
  const terms = searchTerms(query);
  const isFiltering = terms.length > 0 || status !== 'all';
  const emailOf = (accountId: string) =>
    connectedAccounts.find((item) => item.id === accountId)?.emailAddress ?? null;

  useEffect(() => {
    const focusSearchOnSlash = (e: KeyboardEvent) => {
      const isTyping = (e.target as HTMLElement).closest('input, textarea, select');
      if (e.key !== '/' || isTyping) return;

      e.preventDefault();
      searchRef.current?.focus();
    };

    document.addEventListener('keydown', focusSearchOnSlash);
    return () => document.removeEventListener('keydown', focusSearchOnSlash);
  }, []);

  const selectAccount = (accountId: string | null) => setParams(accountId ? { account: accountId } : {});

  const clearSearch = () => {
    setQuery('');
    setField('all');
    setStatus('all');
  };

  const openCreate = () => {
    setEditingRule(null);
    setIsFormOpen(true);
  };

  const openEdit = (rule: EmailRule) => {
    setEditingRule(rule);
    setIsFormOpen(true);
  };

  const formAccountId = editingRule?.accountId ?? account?.id ?? null;

  return (
    <div className='EmailRules'>
      <header>
        <div className='Right_Side'>
          <button className='EmailRules_back' onClick={() => navigate('/MyHomeLab/Apps/Gmail')}>
            {t('rules.back')}
          </button>
          <span>{t('rules.title')}</span>
        </div>

        <div className='Left_Side'>
          {account && (
            <>
              <button className='EmailRules_run' disabled={loading} onClick={() => runEmailRules('INBOX')}>
                {t('run.inbox')}
              </button>
              <button className='EmailRules_run' disabled={loading} onClick={() => runEmailRules('ALL')}>
                {t('run.all')}
              </button>
            </>
          )}
          <button
            className='EmailRules_add'
            onClick={openCreate}
            disabled={!account}
            title={account ? undefined : t('rules.pickAccount')}
          >
            <Icon.Plus />
            <span>{t('rules.new')}</span>
          </button>
        </div>
      </header>

      {connectedAccounts.length > 1 && (
        <div className='EmailRules_chips EmailRules_accounts' role='group' aria-label={t('rules.accountsLabel')}>
          <button
            type='button'
            className={account ? '' : 'active'}
            aria-pressed={!account}
            onClick={() => selectAccount(null)}
          >
            {t('rules.allAccounts')}
          </button>
          {connectedAccounts.map((item) => (
            <button
              key={item.id}
              type='button'
              className={account?.id === item.id ? 'active' : ''}
              aria-pressed={account?.id === item.id}
              onClick={() => selectAccount(item.id)}
            >
              {item.emailAddress ?? item.id}
            </button>
          ))}
        </div>
      )}

      {accountRules.length > 0 && (
        <div className='EmailRules_search'>
          <div className='EmailRules_search_box'>
            <Icon.Search />
            <input
              ref={searchRef}
              type='search'
              value={query}
              placeholder={t('search.placeholder')}
              aria-label={t('search.label')}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('');
                  e.currentTarget.blur();
                }
              }}
            />
            {query && (
              <button type='button' aria-label={t('search.clear')} onClick={() => setQuery('')}>
                <Icon.Close />
              </button>
            )}
          </div>

          <div className='EmailRules_search_filters'>
            <div className='EmailRules_chips' role='group' aria-label={t('search.inLabel')}>
              {RULE_SEARCH_FIELDS.map((key) => (
                <button
                  key={key}
                  type='button'
                  className={field === key ? 'active' : ''}
                  aria-pressed={field === key}
                  onClick={() => setField(key)}
                >
                  {t(`search.fields.${key}`)}
                </button>
              ))}
            </div>

            <div className='EmailRules_chips' role='group' aria-label={t('search.statusLabel')}>
              {RULE_STATUS_FILTERS.map((key) => (
                <button
                  key={key}
                  type='button'
                  className={status === key ? 'active' : ''}
                  aria-pressed={status === key}
                  onClick={() => setStatus(key)}
                >
                  {t(`search.status.${key}`)}
                </button>
              ))}
            </div>

            <span className='EmailRules_search_count'>
              {isFiltering
                ? t('search.count', { shown: matches.length, count: accountRules.length })
                : t('search.total', { count: accountRules.length })}
            </span>
          </div>
        </div>
      )}

      <div className='EmailRules_list'>
        {accountRules.length === 0 && <div className='EmailRules_empty'>{t('rules.empty')}</div>}

        {accountRules.length > 0 && matches.length === 0 && (
          <div className='EmailRules_empty'>
            {t('search.noResults')}{' '}
            <button type='button' className='EmailRules_empty_clear' onClick={clearSearch}>
              {t('search.clearAll')}
            </button>
          </div>
        )}

        {matches.map(({ rule, hits }) => (
          <Email_Rule_Row
            key={rule.id}
            rule={rule}
            hits={hits}
            terms={terms}
            field={field}
            accountLabel={account ? null : emailOf(rule.accountId)}
            onEdit={() => openEdit(rule)}
            onChanged={fetchEmailRules}
          />
        ))}
      </div>

      {isFormOpen && formAccountId && (
        <Email_Rule_Form_Modal
          accountId={formAccountId}
          existingRule={editingRule}
          onClose={() => setIsFormOpen(false)}
          onSaved={() => {
            setIsFormOpen(false);
            fetchEmailRules();
          }}
        />
      )}
    </div>
  );
};

export default EmailRules;
