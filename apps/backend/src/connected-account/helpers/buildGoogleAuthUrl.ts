import { JwtService } from '@nestjs/jwt';
import {
  buildGoogleConsentUrl,
  GoogleConnectionKind,
} from '../google/google-oauth.client';
import { GOOGLE_OAUTH_STATE_AUDIENCE } from 'src/auth/token-audience';

export function buildGoogleAuthUrl(
  userId: string,
  kind: GoogleConnectionKind,
  stateJwt: JwtService,
): string {
  // O que se está a ligar vai no state: o callback é o mesmo para o Gmail e o Google Tasks.
  // A audience impede que o state sirva de sessão (o segredo é o mesmo da sessão).
  const state = stateJwt.sign(
    { userId, kind },
    { expiresIn: '10m', audience: GOOGLE_OAUTH_STATE_AUDIENCE },
  );
  return buildGoogleConsentUrl(state, kind);
}
