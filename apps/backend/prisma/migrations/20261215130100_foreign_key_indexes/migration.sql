-- CreateIndex
CREATE INDEX "BoardTask_parentId_idx" ON "BoardTask"("parentId");

-- CreateIndex
CREATE INDEX "BoardTask_cycleId_idx" ON "BoardTask"("cycleId");

-- CreateIndex
CREATE INDEX "BoardTaskRelation_toId_idx" ON "BoardTaskRelation"("toId");

-- CreateIndex
CREATE INDEX "ChatFile_userId_idx" ON "ChatFile"("userId");

-- CreateIndex
CREATE INDEX "ConnectedAccount_serverConnectionId_idx" ON "ConnectedAccount"("serverConnectionId");

-- CreateIndex
CREATE INDEX "Doc_parentId_idx" ON "Doc"("parentId");

-- CreateIndex
CREATE INDEX "Doc_sectionId_idx" ON "Doc"("sectionId");

-- CreateIndex
CREATE INDEX "DocProposal_docId_idx" ON "DocProposal"("docId");

-- CreateIndex
CREATE INDEX "Notification_monitorId_idx" ON "Notification"("monitorId");

-- CreateIndex
CREATE INDEX "Notification_serverConnectionId_idx" ON "Notification"("serverConnectionId");

-- CreateIndex
CREATE INDEX "Notification_connectedAccountId_idx" ON "Notification"("connectedAccountId");

-- CreateIndex
CREATE INDEX "Todo_listId_idx" ON "Todo"("listId");

-- CreateIndex
CREATE INDEX "Todo_parentId_idx" ON "Todo"("parentId");
