-- A Saúde passa a poder ler os treinos pela app openGym ligada (Apps ligadas), sem emparelhamento próprio.
ALTER TABLE "OpenGymConnection" ADD COLUMN "accountId" TEXT,
ALTER COLUMN "token" DROP NOT NULL;

CREATE UNIQUE INDEX "OpenGymConnection_accountId_key" ON "OpenGymConnection"("accountId");

ALTER TABLE "OpenGymConnection" ADD CONSTRAINT "OpenGymConnection_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- As ligações da Saúde que já têm a app ligada no mesmo endereço passam a usá-la: o token próprio sai.
UPDATE "OpenGymConnection" c
SET "accountId" = a.id, "token" = NULL
FROM (
  SELECT DISTINCT ON ("userId", "baseUrl") id, "userId", "baseUrl"
  FROM "ConnectedAccount"
  WHERE provider = 'OPENGYM' AND "isActive" AND "accessToken" IS NOT NULL
  ORDER BY "userId", "baseUrl", "createdAt"
) a
WHERE a."userId" = c."userId" AND a."baseUrl" = c."baseUrl";
