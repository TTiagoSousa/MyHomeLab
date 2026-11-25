import { Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { handleBridge, sendBridgeReply } from './mcpBridge';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * A ponte MCP por onde o Claude Code (a correr nesta máquina) chama as
 * ferramentas do MyHomeLab. Só de dentro da máquina e sem passar pelo nginx
 * (que junta o X-Forwarded-For), e só com o token da corrida.
 */
@Controller('internal/mcp')
export class McpBridgeController {
  @Post(':id')
  async call(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (
      !LOOPBACK.has(req.socket.remoteAddress ?? '') ||
      req.headers['x-forwarded-for']
    ) {
      res.status(403).json({ error: 'Só a partir desta máquina.' });
      return;
    }
    await sendBridgeReply(
      res,
      handleBridge(id, req.headers.authorization, req.body),
      String(req.headers.accept ?? '').includes('text/event-stream'),
    );
  }

  /** Sem notificações do servidor: nada de SSE. */
  @Get(':id')
  stream(@Res() res: Response) {
    res.status(405).end();
  }
}
