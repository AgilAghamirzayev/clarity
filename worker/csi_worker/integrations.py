"""Explicitly enabled adapters. Only approved recommendations leave the local platform."""

import base64
import hashlib
import hmac
import ipaddress
import json
import os
import socket
from urllib.parse import urlparse
from uuid import uuid4

import httpx

from .storage import database


def validate_destination(url):
    parsed = urlparse(url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    allowed = os.environ.get("INTEGRATION_ALLOWED_ORIGINS", "").split(",")
    if parsed.scheme != "https" or parsed.username or parsed.fragment or origin not in allowed:
        raise ValueError("DESTINATION_NOT_ALLOWED")
    addresses = {
        item[4][0]
        for item in socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
    }
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise ValueError("PRIVATE_DESTINATION_BLOCKED")
    return parsed, sorted(addresses)[0]


def request(url, payload, headers):
    parsed, address = validate_destination(url)
    # Pin the validated IP while retaining TLS hostname verification to prevent DNS rebinding.
    target = httpx.URL(url).copy_with(host=address)
    with httpx.Client(timeout=20, follow_redirects=False, trust_env=False) as client:
        response = client.post(
            target,
            content=json.dumps(payload, separators=(",", ":")).encode(),
            headers={**headers, "Host": parsed.netloc, "Content-Type": "application/json"},
            extensions={"sni_hostname": parsed.hostname},
        )
        response.raise_for_status()
        if response.is_redirect:
            raise ValueError("REDIRECT_BLOCKED")
        return response.json() if response.content else {}


def send(kind, config, token, delivery_id, payload):
    headers = {"Idempotency-Key": delivery_id}
    if kind == "crm":
        body = json.dumps(payload, separators=(",", ":")).encode()
        headers["X-CSI-Signature"] = "sha256=" + hmac.new(token.encode(), body, hashlib.sha256).hexdigest()
        result = request(config["endpoint"], payload, headers)
        return str(result.get("id", delivery_id))
    if kind == "slack":
        headers["Authorization"] = "Bearer " + token
        result = request(
            config["endpoint"],
            {
                "channel": config["channel"],
                "client_msg_id": delivery_id,
                "text": f"Approved action: {payload['recommendation']['title']}\n{payload['recommendation']['proposedAction']}",
            },
            headers,
        )
        if not result.get("ok"):
            raise ValueError("SLACK_REJECTED")
        return result["ts"]
    if kind == "jira":
        headers["Authorization"] = "Basic " + base64.b64encode(f"{config['email']}:{token}".encode()).decode()
        base = config["endpoint"].rstrip("/")
        label = "csi-delivery-" + delivery_id
        found = request(
            base + "/rest/api/3/search/jql",
            {"jql": f'labels = "{label}"', "maxResults": 1, "fields": ["key"]},
            headers,
        )
        if found.get("issues"):
            return found["issues"][0]["key"]
        rec = payload["recommendation"]
        result = request(
            base + "/rest/api/3/issue",
            {
                "fields": {
                    "project": {"key": config["project"]},
                    "issuetype": {"name": "Task"},
                    "summary": rec["title"][:250],
                    "labels": [label],
                    "description": {
                        "type": "doc",
                        "version": 1,
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": rec["proposedAction"]}],
                            }
                        ],
                    },
                }
            },
            headers,
        )
        return result["key"]
    raise ValueError("UNKNOWN_INTEGRATION")


def deliver(event):
    with database(event["tenant"]) as conn:
        decision = conn.execute(
            "select d.data as decision,r.data as recommendation from decisions d join recommendations r on r.id=d.recommendation_id where d.id=%s",
            (event["resource"],),
        ).fetchone()
        if not decision or decision["decision"]["status"] == "Rejected":
            raise ValueError("APPROVED_DECISION_REQUIRED")
        integrations = conn.execute("select * from integrations where enabled").fetchall()
    any_failed = False
    for integration in integrations:
        with database(event["tenant"]) as conn:
            conn.execute(
                "insert into deliveries(id,tenant_id,event_id,integration_id) values (%s,%s,%s,%s) on conflict(event_id,integration_id) do nothing",
                (uuid4(), event["tenant"], event["id"], integration["id"]),
            )
            delivery = conn.execute(
                "select * from deliveries where event_id=%s and integration_id=%s",
                (event["id"], integration["id"]),
            ).fetchone()
            if delivery["status"] == "SENT":
                continue
            conn.execute(
                "update deliveries set attempts=attempts+1,status='SENDING',updated_at=now() where id=%s",
                (delivery["id"],),
            )
        try:
            token = os.environ["CSI_INTEGRATION_" + str(integration["id"]).replace("-", "_") + "_TOKEN"]
            payload = dict(
                eventId=event["id"],
                deliveryId=str(delivery["id"]),
                type=event["type"],
                recommendation=decision["recommendation"],
            )
            external = send(integration["kind"], integration["config"], token, str(delivery["id"]), payload)
            with database(event["tenant"]) as conn:
                conn.execute(
                    "update deliveries set status='SENT',external_id=%s,error_code=null,updated_at=now() where id=%s",
                    (external, delivery["id"]),
                )
                conn.execute(
                    "insert into audit(tenant_id,actor,action,resource) values (%s,'integration-worker','integration.sent',%s)",
                    (event["tenant"], str(delivery["id"])),
                )
        except Exception:
            any_failed = True
            with database(event["tenant"]) as conn:
                conn.execute(
                    "update deliveries set status='RETRYING',error_code='DELIVERY_FAILED',updated_at=now() where id=%s",
                    (delivery["id"],),
                )
    if any_failed:
        raise RuntimeError("DELIVERY_FAILED")
