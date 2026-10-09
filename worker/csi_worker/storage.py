import os
from contextlib import contextmanager

import boto3
import psycopg
from psycopg.rows import dict_row


@contextmanager
def database(tenant):
    from uuid import UUID

    tenant = str(UUID(tenant))
    with psycopg.connect(
        os.environ.get("DATABASE_URL", "postgresql://csi_app@localhost:5546/csi"),
        password=os.environ["DB_APP_PASSWORD"],
        row_factory=dict_row,
    ) as conn:
        conn.execute("select set_config('app.tenant_id',%s,true)", (tenant,))
        yield conn


def objects():
    return boto3.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT", "http://localhost:9100"),
        aws_access_key_id=os.environ["S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["S3_SECRET_KEY"],
        region_name="us-east-1",
    )


def bucket():
    return os.environ.get("S3_BUCKET", "csi-audio")
