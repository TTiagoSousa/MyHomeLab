import type { TFunction } from 'i18next';
import type { UpdateAttemptKind, UpdateAttemptStatus } from './updateAttemptTypes';

interface Labelled {
  kind: UpdateAttemptKind;
  status: UpdateAttemptStatus;
  title: string;
  installNumber: number | null;
}

const STATUS_GROUP: Record<UpdateAttemptKind, string> = { STUDY: 'studyStatus', UPDATE: 'status' };

export const attemptTitle = (attempt: Labelled, t: TFunction) => {
  const title = attempt.title.replace(/^Estudo · /, '');
  const kind = t(`docs:attempts.kind.${attempt.kind}`);
  return attempt.installNumber && attempt.installNumber > 1
    ? t('docs:attempts.headingNumbered', { kind, number: attempt.installNumber, title })
    : t('docs:attempts.heading', { kind, title });
};

export const attemptStatus = (attempt: Labelled, t: TFunction) => t(`docs:attempts.${STATUS_GROUP[attempt.kind]}.${attempt.status}`);

export const attemptStatusHint = (attempt: Labelled, t: TFunction) => t(`docs:attempts.${STATUS_GROUP[attempt.kind]}Hint.${attempt.status}`);
