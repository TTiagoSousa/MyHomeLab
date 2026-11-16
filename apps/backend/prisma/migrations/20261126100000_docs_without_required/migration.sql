-- Sai o "obrigatório" dos documentos: os agentes passam a ler os que o pedido toca,
-- pelos títulos, pelas etiquetas e pelo que estão ligados (e as ferramentas que mudam
-- coisas só respondem depois de os lerem).
ALTER TABLE "Doc" DROP COLUMN "required";
