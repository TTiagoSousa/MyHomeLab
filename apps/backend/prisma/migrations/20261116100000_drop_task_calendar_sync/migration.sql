-- Sai tudo o que eram tarefas e calendários do Nextcloud e do Google (para recomeçar
-- de novo): as sincronizações, as tarefas dos alertas no Nextcloud e o pedido de
-- resposta do quadro no Nextcloud. As perguntas do quadro passam a "awaitingReply".

-- AlterTable: a tarefa do quadro que esperava resposta continua à espera.
ALTER TABLE "BoardTask" ADD COLUMN "awaitingReply" BOOLEAN NOT NULL DEFAULT false;
UPDATE "BoardTask" SET "awaitingReply" = true WHERE "reminderUrl" IS NOT NULL;
ALTER TABLE "BoardTask" DROP COLUMN "reminderUrl";

-- AlterTable
ALTER TABLE "ConnectedAccount" DROP COLUMN "calendarRunFrequency";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "taskUrl";

-- Os agentes deixam de ter as ferramentas que já não existem.
UPDATE "Agent"
SET "tools" = ARRAY(
  SELECT tool FROM unnest("tools") AS tool
  WHERE tool NOT IN (
    'list_task_lists', 'list_tasks', 'create_task', 'create_task_list',
    'complete_task', 'delete_task',
    'list_calendars', 'list_events', 'create_event', 'delete_event'
  )
)
WHERE "tools" && ARRAY[
  'list_task_lists', 'list_tasks', 'create_task', 'create_task_list',
  'complete_task', 'delete_task',
  'list_calendars', 'list_events', 'create_event', 'delete_event'
]::TEXT[];

-- DropForeignKey
ALTER TABLE "CalendarSyncEvent" DROP CONSTRAINT "CalendarSyncEvent_pairId_fkey";
ALTER TABLE "CalendarSyncPair" DROP CONSTRAINT "CalendarSyncPair_googleAccountId_fkey";
ALTER TABLE "CalendarSyncPair" DROP CONSTRAINT "CalendarSyncPair_nextcloudAccountId_fkey";
ALTER TABLE "CalendarSyncPair" DROP CONSTRAINT "CalendarSyncPair_userId_fkey";
ALTER TABLE "NotificationTaskSetting" DROP CONSTRAINT "NotificationTaskSetting_connectedAccountId_fkey";
ALTER TABLE "NotificationTaskSetting" DROP CONSTRAINT "NotificationTaskSetting_userId_fkey";
ALTER TABLE "Task" DROP CONSTRAINT "Task_parentTaskId_fkey";
ALTER TABLE "Task" DROP CONSTRAINT "Task_syncPairId_fkey";
ALTER TABLE "TaskSyncPair" DROP CONSTRAINT "TaskSyncPair_googleAccountId_fkey";
ALTER TABLE "TaskSyncPair" DROP CONSTRAINT "TaskSyncPair_nextcloudAccountId_fkey";
ALTER TABLE "TaskSyncPair" DROP CONSTRAINT "TaskSyncPair_userId_fkey";

-- DropTable
DROP TABLE "CalendarSyncEvent";
DROP TABLE "CalendarSyncPair";
DROP TABLE "NotificationTaskSetting";
DROP TABLE "Task";
DROP TABLE "TaskSyncPair";

-- DropEnum
DROP TYPE "TaskPlatform";
DROP TYPE "TaskStatus";
