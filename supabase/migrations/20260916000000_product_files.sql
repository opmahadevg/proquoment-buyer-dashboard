-- Migration: 20260916000000_product_files.sql
-- Description: Unified product files table for synchronizing chat uploads, visual previews, and RFQ documents

CREATE TABLE IF NOT EXISTS product_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN (
    'buyer_upload',
    'ai_generated_concept',
    'tech_pack',
    'reference_image',
    'spec_sheet',
    'rfq_document'
  )),
  mime_type TEXT,
  file_size_bytes BIGINT,
  source_context TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_files_product ON product_files(product_id);
CREATE INDEX IF NOT EXISTS idx_product_files_buyer ON product_files(buyer_id);

ALTER TABLE product_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users see own product files" ON product_files;
  CREATE POLICY "Users see own product files" ON product_files FOR ALL USING (
    buyer_id IS NULL OR buyer_id = auth.uid()
  );
END $$;
