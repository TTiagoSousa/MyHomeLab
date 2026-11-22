import { buildGmailQuery } from './gmail-api.client';

const rule = (overrides: Record<string, unknown>) =>
  ({
    fromContains: [],
    subjectContains: [],
    keywords: [],
    excludeKeywords: [],
    matchType: 'CONTAINS',
    conditionLogic: 'ALL',
    hasAttachment: null,
    ...overrides,
  }) as never;

describe('buildGmailQuery', () => {
  it('searches the sender and subject in the Gmail query for CONTAINS', () => {
    expect(
      buildGmailQuery(
        rule({ fromContains: ['amazon.com'], subjectContains: ['Encomenda'] }),
        'INBOX',
      ),
    ).toBe('from:amazon.com subject:Encomenda in:inbox');
  });

  it('keeps a regex out of the Gmail query (it is tested email by email)', () => {
    const query = buildGmailQuery(
      rule({
        matchType: 'REGEX',
        fromContains: ['^.*@amazon\\.com$'],
        subjectContains: ['^Encomenda \\d+'],
      }),
      'INBOX',
    );
    expect(query).toBe('in:inbox');
    expect(query).not.toContain('amazon');
  });

  it('still narrows a REGEX rule by its keywords and attachment', () => {
    expect(
      buildGmailQuery(
        rule({
          matchType: 'REGEX',
          fromContains: ['@amazon\\.com$'],
          keywords: ['fatura'],
          hasAttachment: true,
        }),
        'INBOX',
      ),
    ).toBe('fatura has:attachment in:inbox');
  });
});
