-- Migration to add rfq_state JSONB column to public.rfqs table
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS rfq_state JSONB DEFAULT NULL;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS target_price TEXT DEFAULT NULL;

COMMENT ON COLUMN public.rfqs.rfq_state IS 'Stores structured RFQ state machine JSON (category, specs, quantity, commercial terms)';
COMMENT ON COLUMN public.rfqs.target_price IS 'Stores target price specified by buyer';
