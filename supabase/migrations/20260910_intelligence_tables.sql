-- ═══════════════════════════════════════════════════════════════════
-- PROQUOMENT AI INTELLIGENCE V1 SCHEMA MIGRATION
-- ═══════════════════════════════════════════════════════════════════

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════
-- 1. INTELLIGENCE SESSIONS & MESSAGES
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS intelligence_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID,
  title TEXT,
  workspace_id UUID,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES intelligence_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  structured_data JSONB,
  evidence_ids TEXT[] DEFAULT '{}',
  tool_calls JSONB,
  tool_results JSONB,
  suggested_actions JSONB DEFAULT '[]',
  research_state TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════
-- 2. SOURCING OBJECTS & WORKSPACES
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS intelligence_workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID,
  product_name TEXT NOT NULL,
  hs_code TEXT,
  destination_country TEXT NOT NULL,
  destination_country_name TEXT,
  origin_countries TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'converted')),
  sourcing_score INT,
  score_factors JSONB,
  rfq_id TEXT,
  rfq_readiness JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_sourcing_objects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES intelligence_workspaces(id) ON DELETE CASCADE,
  product JSONB NOT NULL DEFAULT '{}',
  market JSONB NOT NULL DEFAULT '{}',
  supply JSONB NOT NULL DEFAULT '{}',
  economics JSONB NOT NULL DEFAULT '{}',
  compliance JSONB NOT NULL DEFAULT '{}',
  logistics JSONB NOT NULL DEFAULT '{}',
  decision JSONB,
  assumptions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Link sourcing object back to workspace optionally
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'intelligence_workspaces' AND column_name = 'sourcing_object_id'
  ) THEN
    ALTER TABLE intelligence_workspaces 
    ADD COLUMN sourcing_object_id UUID REFERENCES intelligence_sourcing_objects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════
-- 3. EVIDENCE SYSTEM (NORMALIZED)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS intelligence_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  publisher TEXT,
  type TEXT NOT NULL CHECK (type IN (
    'official', 'transactional', 'commercial',
    'company-provided', 'secondary', 'ai-search'
  )),
  url TEXT,
  published_at TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_period TEXT,
  license TEXT
);

CREATE TABLE IF NOT EXISTS intelligence_evidence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES intelligence_workspaces(id) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  source_id UUID NOT NULL REFERENCES intelligence_sources(id) ON DELETE CASCADE,
  value JSONB,
  unit TEXT,
  classification TEXT NOT NULL CHECK (classification IN (
    'observed', 'calculated', 'ai-inference'
  )),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  methodology TEXT,
  observed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_calculations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES intelligence_workspaces(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  formula TEXT NOT NULL,
  inputs JSONB NOT NULL,
  result JSONB NOT NULL,
  evidence_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_data_gaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES intelligence_workspaces(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'product', 'trade', 'price', 'supplier',
    'compliance', 'logistics', 'commercial'
  )),
  description TEXT NOT NULL,
  importance TEXT NOT NULL CHECK (importance IN (
    'critical', 'high', 'medium', 'low'
  )),
  recommended_action TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════
-- 4. RESEARCH & TOOL EXECUTION LOGS
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS intelligence_research_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES intelligence_sessions(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES intelligence_workspaces(id) ON DELETE SET NULL,
  objective JSONB NOT NULL,
  research_plan JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'planning', 'confirmed', 'executing',
    'completed', 'failed', 'cancelled'
  )),
  progress INT DEFAULT 0,
  results JSONB,
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_tool_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES intelligence_workspaces(id) ON DELETE SET NULL,
  session_id UUID REFERENCES intelligence_sessions(id) ON DELETE SET NULL,
  research_job_id UUID REFERENCES intelligence_research_jobs(id) ON DELETE SET NULL,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  provider TEXT,
  parameters JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  status TEXT NOT NULL CHECK (status IN (
    'running', 'success', 'no_data', 'partial_data',
    'provider_error', 'invalid_input', 'timeout', 'rate_limited'
  )),
  error TEXT,
  result_summary JSONB,
  input_tokens INT,
  output_tokens INT,
  cost_estimate NUMERIC(10, 6)
);

-- ═══════════════════════════════════════════
-- 5. CACHE & REFERENCE DATA
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS intelligence_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  provider_version TEXT,
  schema_version TEXT DEFAULT '1',
  capability TEXT NOT NULL,
  params JSONB NOT NULL,
  raw_response JSONB,
  normalized_response JSONB NOT NULL,
  source JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  retrieved_at TIMESTAMPTZ DEFAULT now(),
  hit_count INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS intelligence_reference_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_type TEXT NOT NULL,
  key TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(data_type, key)
);

-- ═══════════════════════════════════════════
-- 6. INDEXES
-- ═══════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_sessions_buyer ON intelligence_sessions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON intelligence_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_buyer ON intelligence_workspaces(buyer_id);
CREATE INDEX IF NOT EXISTS idx_evidence_workspace ON intelligence_evidence(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tool_runs_workspace ON intelligence_tool_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tool_runs_buyer ON intelligence_tool_runs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_cache_key ON intelligence_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON intelligence_cache(expires_at);

-- ═══════════════════════════════════════════
-- 7. ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════

ALTER TABLE intelligence_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_sourcing_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_data_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_tool_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_reference_data ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DO $$
BEGIN
  -- Sessions
  DROP POLICY IF EXISTS "Users see own sessions" ON intelligence_sessions;
  CREATE POLICY "Users see own sessions" ON intelligence_sessions FOR ALL USING (buyer_id = auth.uid());

  -- Messages
  DROP POLICY IF EXISTS "Users see own messages" ON intelligence_messages;
  CREATE POLICY "Users see own messages" ON intelligence_messages FOR ALL USING (
    session_id IN (SELECT id FROM intelligence_sessions WHERE buyer_id = auth.uid())
  );

  -- Workspaces
  DROP POLICY IF EXISTS "Users see own workspaces" ON intelligence_workspaces;
  CREATE POLICY "Users see own workspaces" ON intelligence_workspaces FOR ALL USING (buyer_id = auth.uid());

  -- Sourcing Objects
  DROP POLICY IF EXISTS "Users see own sourcing objects" ON intelligence_sourcing_objects;
  CREATE POLICY "Users see own sourcing objects" ON intelligence_sourcing_objects FOR ALL USING (
    workspace_id IN (SELECT id FROM intelligence_workspaces WHERE buyer_id = auth.uid())
  );

  -- Evidence
  DROP POLICY IF EXISTS "Users see own evidence" ON intelligence_evidence;
  CREATE POLICY "Users see own evidence" ON intelligence_evidence FOR ALL USING (
    workspace_id IN (SELECT id FROM intelligence_workspaces WHERE buyer_id = auth.uid())
  );

  -- Calculations
  DROP POLICY IF EXISTS "Users see own calculations" ON intelligence_calculations;
  CREATE POLICY "Users see own calculations" ON intelligence_calculations FOR ALL USING (
    workspace_id IN (SELECT id FROM intelligence_workspaces WHERE buyer_id = auth.uid())
  );

  -- Data Gaps
  DROP POLICY IF EXISTS "Users see own data gaps" ON intelligence_data_gaps;
  CREATE POLICY "Users see own data gaps" ON intelligence_data_gaps FOR ALL USING (
    workspace_id IN (SELECT id FROM intelligence_workspaces WHERE buyer_id = auth.uid())
  );

  -- Research Jobs
  DROP POLICY IF EXISTS "Users see own research jobs" ON intelligence_research_jobs;
  CREATE POLICY "Users see own research jobs" ON intelligence_research_jobs FOR ALL USING (
    session_id IN (SELECT id FROM intelligence_sessions WHERE buyer_id = auth.uid())
  );

  -- Tool Runs
  DROP POLICY IF EXISTS "Users see own tool runs" ON intelligence_tool_runs;
  CREATE POLICY "Users see own tool runs" ON intelligence_tool_runs FOR ALL USING (buyer_id = auth.uid());

  -- Sources (publicly readable to authenticated users)
  DROP POLICY IF EXISTS "Authenticated users can read sources" ON intelligence_sources;
  CREATE POLICY "Authenticated users can read sources" ON intelligence_sources FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Service role manages sources" ON intelligence_sources;
  CREATE POLICY "Service role manages sources" ON intelligence_sources FOR ALL USING (auth.role() = 'service_role');

  -- Cache & Reference Data (Service role only)
  DROP POLICY IF EXISTS "Service role cache access" ON intelligence_cache;
  CREATE POLICY "Service role cache access" ON intelligence_cache FOR ALL USING (auth.role() = 'service_role');

  DROP POLICY IF EXISTS "Authenticated read reference data" ON intelligence_reference_data;
  CREATE POLICY "Authenticated read reference data" ON intelligence_reference_data FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Service role reference data" ON intelligence_reference_data FOR ALL USING (auth.role() = 'service_role');
END $$;
