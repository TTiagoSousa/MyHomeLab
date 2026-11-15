import { AiCredentialService } from 'src/ai-credential/ai-credential.service';
import type { AiClient } from 'src/ai-credential/ai-client';

/** A IA do utilizador (o fornecedor em uso); sem chave, o erro que manda configurá-la. */
export function requireAnthropic(
  aiCredentials: AiCredentialService,
  userId: string,
): Promise<AiClient> {
  return aiCredentials.requireClient(userId);
}
