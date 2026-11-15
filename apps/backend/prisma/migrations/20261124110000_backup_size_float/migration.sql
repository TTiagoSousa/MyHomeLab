-- O tamanho dos backups passa a Float: o do Forgejo já vai em 1,3 GB e um Int pára nos 2,1 GB.
ALTER TABLE "BackupRun" ALTER COLUMN "sizeBytes" TYPE DOUBLE PRECISION;
