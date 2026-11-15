import type { EmailRule } from '../../../../Hooks/EmailRule/useEmailRules';

export const RULE_SEARCH_FIELDS = ['all', 'name', 'labels', 'from', 'subject', 'keywords'] as const;
export type RuleSearchField = (typeof RULE_SEARCH_FIELDS)[number];

export const RULE_STATUS_FILTERS = ['all', 'active', 'inactive', 'bulk'] as const;
export type RuleStatusFilter = (typeof RULE_STATUS_FILTERS)[number];

type SearchableField = Exclude<RuleSearchField, 'all'>;

const SEARCHABLE_FIELDS: SearchableField[] = ['name', 'labels', 'from', 'subject', 'keywords'];

export interface RuleMatch {
  rule: EmailRule;
  hits: { field: SearchableField; values: string[] }[];
}

export const foldText = (text: string) =>
  Array.from(text, (char) => char.normalize('NFD')[0].toLowerCase()).join('');

export const searchTerms = (query: string) => foldText(query).split(/\s+/).filter(Boolean);

const fieldValues = (rule: EmailRule): Record<SearchableField, string[]> => ({
  name: [rule.name],
  labels: rule.labelPaths.map((entry) => entry.path),
  from: rule.fromContains,
  subject: rule.subjectContains,
  keywords: [...rule.keywords, ...rule.excludeKeywords],
});

const matchesStatus = (rule: EmailRule, status: RuleStatusFilter) => {
  if (status === 'active') return rule.isActive;
  if (status === 'inactive') return !rule.isActive;
  if (status === 'bulk') return rule.mailKind !== 'ANY';
  return true;
};

export const searchRules = (
  rules: EmailRule[],
  query: string,
  field: RuleSearchField,
  status: RuleStatusFilter,
): RuleMatch[] => {
  const terms = searchTerms(query);
  const fields = field === 'all' ? SEARCHABLE_FIELDS : [field];
  const matches: RuleMatch[] = [];

  for (const rule of rules) {
    if (!matchesStatus(rule, status)) continue;

    if (terms.length === 0) {
      matches.push({ rule, hits: [] });
      continue;
    }

    const values = fieldValues(rule);
    const containsTerm = (value: string, term: string) => foldText(value).includes(term);

    const allTermsFound = terms.every((term) =>
      fields.some((key) => values[key].some((value) => containsTerm(value, term))),
    );
    if (!allTermsFound) continue;

    const hits = fields
      .map((key) => ({
        field: key,
        values: values[key].filter((value) => terms.some((term) => containsTerm(value, term))),
      }))
      .filter((hit) => hit.values.length > 0);

    matches.push({ rule, hits });
  }

  return matches;
};
