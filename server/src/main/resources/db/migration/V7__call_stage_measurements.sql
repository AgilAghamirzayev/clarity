CREATE TABLE call_stage_attempts (
  tenant_id uuid NOT NULL,
  call_id uuid NOT NULL,
  generation integer NOT NULL,
  stage text NOT NULL CHECK (stage IN ('transcription','analysis','clustering')),
  attempt integer NOT NULL CHECK (attempt > 0),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  elapsed_ms double precision,
  status text NOT NULL CHECK (status IN ('RUNNING','SUCCEEDED','FAILED')),
  error_code text,
  PRIMARY KEY (tenant_id,call_id,generation,stage,attempt),
  FOREIGN KEY (tenant_id,call_id) REFERENCES calls(tenant_id,id)
);
ALTER TABLE call_stage_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_stage_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON call_stage_attempts
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
