ALTER TABLE tenants ADD COLUMN demo_seed_version text;
ALTER TABLE support_summaries ADD COLUMN is_demo_seed boolean NOT NULL DEFAULT false;
