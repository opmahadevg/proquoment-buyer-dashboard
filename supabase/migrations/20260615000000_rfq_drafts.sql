-- ============================================================
-- RFQ Drafts — Persistent draft storage for AI chatbot RFQ builder
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rfq_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Untitled RFQ',
  product_text TEXT,
  rfq_data JSONB DEFAULT '{}'::jsonb,
  conversation_history JSONB DEFAULT '[]'::jsonb,
  messages JSONB DEFAULT '[]'::jsonb,
  completion_pct INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfq_drafts_buyer ON rfq_drafts(buyer_id);

ALTER TABLE rfq_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyer_own_drafts" ON rfq_drafts;
CREATE POLICY "buyer_own_drafts"
  ON rfq_drafts FOR ALL TO authenticated
  USING (buyer_id = auth.uid()::uuid)
  WITH CHECK (buyer_id = auth.uid()::uuid);

-- Add to realtime publication
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE rfq_drafts;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END; $$;
