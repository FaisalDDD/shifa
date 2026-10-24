-- Free-form pack size for a pharmacy's stock line (e.g. "20 tabs", "30 ml").
-- The pharmacy types this when marking a product AVAILABLE; there is no
-- predefined size list. Strength and dosage form remain on the product catalog.
alter table public.pharmacy_inventory add column size text;
