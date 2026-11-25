import { Global, Module } from '@nestjs/common';
import { ApiTokenController } from './api-token.controller';
import { ApiTokenService } from './api-token.service';

/** Global porque o JwtAuthGuard, usado em todos os módulos, aceita também estes tokens. */
@Global()
@Module({
  controllers: [ApiTokenController],
  providers: [ApiTokenService],
  exports: [ApiTokenService],
})
export class ApiTokenModule {}
