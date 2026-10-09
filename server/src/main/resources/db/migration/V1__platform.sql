CREATE TABLE tenants (id uuid PRIMARY KEY, slug text UNIQUE NOT NULL);
CREATE TABLE users (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants, email text NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK (role IN ('ADMIN','ANALYST','REVIEWER','VIEWER')), enabled boolean NOT NULL DEFAULT true, UNIQUE(tenant_id,email));
CREATE TABLE login_attempts (identity text PRIMARY KEY, attempts integer NOT NULL, window_start timestamptz NOT NULL);
CREATE TABLE calls (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants, import_key text NOT NULL, audio_key text NOT NULL, sha256 text NOT NULL, content_type text NOT NULL, status text NOT NULL DEFAULT 'QUEUED', stage text NOT NULL DEFAULT 'import', error_code text, attempts integer NOT NULL DEFAULT 0, generation integer NOT NULL DEFAULT 1, metadata jsonb NOT NULL, transcript jsonb, analysis jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,import_key), UNIQUE(tenant_id,id));
CREATE INDEX calls_tenant_date ON calls(tenant_id,created_at DESC);
CREATE TABLE issues (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants, data jsonb NOT NULL, centroid vector(768) NOT NULL, model text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id));
CREATE TABLE call_issues (tenant_id uuid NOT NULL, call_id uuid NOT NULL, issue_id uuid NOT NULL, mentions integer NOT NULL CHECK(mentions>0), evidence jsonb NOT NULL, PRIMARY KEY(tenant_id,call_id,issue_id), FOREIGN KEY(tenant_id,call_id) REFERENCES calls(tenant_id,id), FOREIGN KEY(tenant_id,issue_id) REFERENCES issues(tenant_id,id));
CREATE TABLE recommendations (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, issue_id uuid NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,issue_id), UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,issue_id) REFERENCES issues(tenant_id,id));
CREATE TABLE decisions (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, recommendation_id uuid NOT NULL, data jsonb NOT NULL, version integer NOT NULL, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,recommendation_id), FOREIGN KEY(tenant_id,recommendation_id) REFERENCES recommendations(tenant_id,id));
CREATE TABLE audit (id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants, actor text NOT NULL, action text NOT NULL, resource text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE notifications (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants, title text NOT NULL, resource text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE integrations (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants, kind text NOT NULL CHECK(kind IN ('slack','jira','crm')), enabled boolean NOT NULL DEFAULT false, config jsonb NOT NULL, UNIQUE(tenant_id,kind));
CREATE TABLE deliveries (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants, event_id uuid NOT NULL, integration_id uuid NOT NULL REFERENCES integrations, status text NOT NULL DEFAULT 'PENDING', attempts integer NOT NULL DEFAULT 0, external_id text, error_code text, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(event_id,integration_id));
CREATE TABLE outbox (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants, type text NOT NULL, resource_id uuid NOT NULL, generation integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz, attempts integer NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now(), error_code text);
CREATE INDEX outbox_pending ON outbox(next_attempt) WHERE published_at IS NULL;
CREATE TABLE spring_session (primary_id char(36) PRIMARY KEY, session_id char(36) UNIQUE NOT NULL, creation_time bigint NOT NULL, last_access_time bigint NOT NULL, max_inactive_interval integer NOT NULL, expiry_time bigint NOT NULL, principal_name varchar(100));
CREATE INDEX spring_session_expiry ON spring_session(expiry_time);
CREATE TABLE spring_session_attributes (session_primary_id char(36) NOT NULL REFERENCES spring_session(primary_id) ON DELETE CASCADE, attribute_name varchar(200) NOT NULL, attribute_bytes bytea NOT NULL, PRIMARY KEY(session_primary_id,attribute_name));
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['calls','issues','call_issues','recommendations','decisions','audit','notifications','integrations','deliveries'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_scope ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
  END LOOP;
END $$;
REVOKE UPDATE, DELETE ON audit FROM csi_app;
