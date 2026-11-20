-- O Plane (gestão de projetos) e o Gitea Mirror (espelhos do GitHub no Gitea/Forgejo) como apps ligadas.
ALTER TYPE "ConnectionProvider" ADD VALUE 'PLANE';
ALTER TYPE "ConnectionProvider" ADD VALUE 'GITEA_MIRROR';
