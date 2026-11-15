import { JwtService } from '@nestjs/jwt';
import {
  buildGoogleConsentUrl,
  GoogleConnectionKind,
} from '../google/google-oauth.client';

export function buildGoogleAuthUrl(
  userId: string,
  kind: GoogleConnectionKind,
  stateJwt: JwtService,
): string {
  // O que se está a ligar vai no state: o callback é o mesmo para o Gmail e o Google Tasks.
  const state = stateJwt.sign({ userId, kind }, { expiresIn: '10m' });
  return buildGoogleConsentUrl(state, kind);
}
