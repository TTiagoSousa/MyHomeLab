import {
  UpdateCheckPhase,
  UpdateCheckState,
} from 'src/generated/prisma/client/client';
import { PENDING_EVIDENCE } from '../app-update.constants';
import { UpdateAttemptService } from '../update-attempt.service';
import { UpdateCheck } from './updateChecks';

/** Os pontos de uma fase como ficaram na tentativa (sem tentativa, os que vieram). */
export async function attemptChecks(
  attempts: UpdateAttemptService,
  updateId: string,
  phase: UpdateCheckPhase,
  fallback: UpdateCheck[],
): Promise<UpdateCheck[]> {
  const attempt = await attempts.current(updateId);
  if (!attempt) return fallback;
  return attempt.checks
    .filter((check) => check.phase === phase)
    .map((check) => ({
      point: check.point,
      ok:
        check.state === UpdateCheckState.NOT_APPLICABLE ||
        check.state === UpdateCheckState.SKIPPED
          ? null
          : check.state === UpdateCheckState.VALIDATED,
      evidence:
        check.state === UpdateCheckState.PENDING
          ? PENDING_EVIDENCE
          : (check.evidence ?? ''),
      source: check.who === 'code' ? 'code' : 'agent',
    }));
}
