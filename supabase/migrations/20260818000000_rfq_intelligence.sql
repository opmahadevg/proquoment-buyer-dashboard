-- Add rfq_state column to rfq_drafts to hold the new RFQState JSON
ALTER TABLE public.rfq_drafts 
ADD COLUMN IF NOT EXISTS rfq_state JSONB DEFAULT NULL;

-- Add rfq_state column to rfqs table to preserve provenance upon finalization
ALTER TABLE public.rfqs 
ADD COLUMN IF NOT EXISTS rfq_state JSONB DEFAULT NULL;
