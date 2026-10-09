ALTER TABLE tenants ADD COLUMN demo_expires_at timestamptz;
CREATE INDEX tenants_demo_expiry ON tenants(demo_expires_at) WHERE demo_expires_at IS NOT NULL;
CREATE TABLE service_heartbeats (service text PRIMARY KEY, ready boolean NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
