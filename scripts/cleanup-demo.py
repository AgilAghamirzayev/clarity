"""Remove expired demo workspaces after a 24-hour processing grace period."""

import argparse
import os
import time

import boto3
import psycopg
from botocore.exceptions import BotoCoreError, ClientError
from psycopg.rows import dict_row

TABLES = [
    "call_stage_attempts",
    "analysis_profiles",
    "ingestion_sources",
    "deliveries",
    "integrations",
    "decisions",
    "recommendations",
    "call_issues",
    "issues",
    "support_summaries",
    "notifications",
    "audit",
    "outbox",
    "calls",
    "users",
]


def clean():
    objects = boto3.client(
        "s3",
        endpoint_url=os.environ["S3_ENDPOINT"],
        aws_access_key_id=os.environ["S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["S3_SECRET_KEY"],
        region_name="us-east-1",
    )
    with psycopg.connect(
        os.environ.get(
            "OWNER_DATABASE_URL", "postgresql://csi_owner@localhost:5546/csi"
        ),
        password=os.environ["DB_OWNER_PASSWORD"],
        row_factory=dict_row,
    ) as conn:
        expired = conn.execute(
            "select id from tenants where demo_expires_at < now()-interval '24 hours' order by demo_expires_at limit 20 for update skip locked"
        ).fetchall()
        for row in expired:
            tenant = row["id"]
            for call in conn.execute(
                "select audio_key from calls where tenant_id=%s", (tenant,)
            ).fetchall():
                key = call["audio_key"]
                if not key.startswith(str(tenant) + "/"):
                    raise ValueError("DEMO_AUDIO_KEY_OUTSIDE_TENANT")
                objects.delete_object(
                    Bucket=os.environ.get("S3_BUCKET", "csi-audio"), Key=key
                )
            for table in TABLES:
                conn.execute(
                    psycopg.sql.SQL("delete from {} where tenant_id=%s").format(
                        psycopg.sql.Identifier(table)
                    ),
                    (tenant,),
                )
            conn.execute(
                "delete from tenants where id=%s and demo_expires_at < now()-interval '24 hours'",
                (tenant,),
            )
        conn.execute(
            "delete from login_attempts where identity like 'demo:%%' and window_start < now()-interval '1 day'"
        )
        print(f"Removed {len(expired)} expired demo workspaces.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--loop", action="store_true")
    args = parser.parse_args()
    while True:
        try:
            clean()
        except (psycopg.Error, BotoCoreError, ClientError, ValueError):
            print(
                "Demo cleanup failed; will retry. Check database and object storage availability.",
                flush=True,
            )
            if not args.loop:
                raise SystemExit(1) from None
        if not args.loop:
            break
        time.sleep(300)
