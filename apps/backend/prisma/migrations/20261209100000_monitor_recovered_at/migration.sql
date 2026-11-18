-- Quando o serviço voltou a responder: a tarefa da falha fecha-se sozinha se ficar estável.
ALTER TABLE "ServiceMonitor" ADD COLUMN "recoveredAt" TIMESTAMP(3);
