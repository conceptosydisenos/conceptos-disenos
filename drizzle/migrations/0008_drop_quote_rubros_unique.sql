-- Allow multiple "personalizado" rubros per quote.
-- The unique index on (quote_id, rubro_type) prevented inserting more than one
-- row with rubro_type = 'personalizado' for the same quote, causing the
-- DELETE + INSERT save flow to lose ALL rubros when 2+ custom rubros were present.
DROP INDEX IF EXISTS "quote_rubros_quote_type_uq";
