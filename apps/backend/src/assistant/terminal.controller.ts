import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { isTerminalToken } from 'src/claude-code/terminalToken';
import { AssistantService } from './assistant.service';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * O terminal (`npm run claude`): abre uma sessão — a ponte MCP com as
 * ferramentas do terminal, o MCP do TREK e as instruções — para o Claude Code
 * que corre nesta máquina. Só de dentro da máquina, sem passar pelo nginx, e só
 * com o token do terminal.
 */
@Controller('internal/terminal')
export class TerminalController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('session')
  async session(@Req() req: Request, @Res() res: Response) {
    if (
      !LOOPBACK.has(req.socket.remoteAddress ?? '') ||
      req.headers['x-forwarded-for'] ||
      !isTerminalToken(req.headers.authorization)
    ) {
      res.status(403).json({ error: 'Só o terminal desta máquina.' });
      return;
    }
    res.json(await this.assistant.terminalSession());
  }
}
