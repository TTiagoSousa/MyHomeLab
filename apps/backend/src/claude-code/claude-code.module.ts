import { Module } from '@nestjs/common';
import { McpBridgeController } from './mcp-bridge.controller';

/** O Claude Code: a ponte MCP por onde as corridas chamam as ferramentas do MyHomeLab. */
@Module({ controllers: [McpBridgeController] })
export class ClaudeCodeModule {}
