CREATE TABLE support_summaries (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants,
  request_key text NOT NULL,
  days integer NOT NULL CHECK (days IN (7,30,90)),
  include_samples boolean NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','PROCESSING','COMPLETED','FAILED')),
  snapshot jsonb NOT NULL,
  report jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,request_key)
);
CREATE INDEX support_summaries_latest ON support_summaries(tenant_id,days,include_samples,created_at DESC);
CREATE UNIQUE INDEX support_summaries_active ON support_summaries(tenant_id,days,include_samples) WHERE status IN ('QUEUED','PROCESSING');
ALTER TABLE support_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_summaries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON support_summaries USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
