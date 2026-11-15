-- Um cliente de API próprio de uma app ligada (TREK: o cliente máquina do MCP).
ALTER TABLE "ConnectedAccount" ADD COLUMN "apiClientId" TEXT,
ADD COLUMN "apiClientSecret" TEXT;
