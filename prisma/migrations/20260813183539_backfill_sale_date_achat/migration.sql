-- Remplit rétroactivement Sale.dateAchat pour les ventes déjà existantes issues du Stock
-- (créées avant l'ajout de ce champ) en reprenant la date d'achat du StockItem d'origine.
-- Les ventes directes (jamais passées par le Stock) n'ont pas de vraie date d'achat connue
-- et restent volontairement à NULL plutôt que de deviner une valeur.
UPDATE "Sale"
SET "dateAchat" = "StockItem"."dateAchat"
FROM "StockItem"
WHERE "StockItem"."saleId" = "Sale"."id"
  AND "Sale"."dateAchat" IS NULL;
