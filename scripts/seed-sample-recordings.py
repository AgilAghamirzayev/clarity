"""Import clearly marked, generated support calls through the real local pipeline.

Requires macOS speech voices Samantha and Daniel. No customer data is used and
no decisions are approved, so this script cannot trigger partner deliveries.
"""

import json
import os
import subprocess
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

SCENARIOS = [
    (
        "Verification code arrives after expiry",
        "Digital banking",
        "Aysel M. (sample)",
        "1042",
        1,
        "I cannot sign in to mobile banking. I requested a verification code three times this morning. Each text arrived after the code had already expired. I still cannot access my account.",
        "I understand. I will log the delayed verification messages with our digital support team. Please do not share any verification code. We will investigate the delivery timestamps.",
    ),
    (
        "Replacement card has no delivery update",
        "Card services",
        "Murad A. (sample)",
        "1087",
        2,
        "I ordered a replacement card eight days ago. The app still says processing and there is no expected delivery date. This is my second call because I need the card before travelling.",
        "I can see why you need a clear update. I will open a delivery enquiry with card operations and request an estimated delivery date. The delivery has not been confirmed yet.",
    ),
    (
        "Transfer fee was not clear before payment",
        "Payments",
        "Nigar R. (sample)",
        "1123",
        3,
        "I sent a bank transfer yesterday and noticed an extra fee afterwards. I did not understand the charge on the confirmation screen. I want the full cost to be clearer before I send money.",
        "I will explain the current fee schedule and record your feedback about the confirmation screen. I cannot promise a refund, but I can request a review of the charge.",
    ),
    (
        "Card activation completed successfully",
        "Card services",
        "Murad A. (sample)",
        "1156",
        0,
        "I am calling to confirm that my new card activated successfully in the app. It only took a minute and my first purchase worked. Everything is working well, thank you.",
        "Thank you for letting us know. Your card is ready to use. You can view its controls in the mobile app if you need to change a spending limit.",
    ),
    (
        "Repayment schedule explained",
        "Lending support",
        "Aysel M. (sample)",
        "1194",
        4,
        "I would like to understand my repayment schedule. The dates are visible in the app, but I need someone to explain how the monthly amount includes interest. I have not missed any payments.",
        "Of course. Each monthly payment includes the principal and interest shown in your schedule. I can guide you through the breakdown and show you where to find the total repayment amount.",
    ),
    (
        "Sign-in blocked by another delayed code",
        "Digital banking",
        "Nigar R. (sample)",
        "1228",
        5,
        "My login code keeps arriving too late. I tried signing in twice today and both codes expired before the messages arrived. I need access to mobile banking to check a transfer.",
        "I will record the failed sign-in attempts and send the code delivery delay to our digital support team for investigation. The issue is still open and I cannot confirm a resolution yet.",
    ),
    (
        "Follow-up on a missing card delivery date",
        "Card services",
        "Murad A. (sample)",
        "1087",
        0,
        "I called about my replacement card earlier and still have not received a delivery update. The tracking page has no date. Can you tell me when I should expect the courier?",
        "I will follow up on the existing delivery enquiry and ask card operations to contact you with a confirmed date. I do not have a confirmed delivery date to share yet.",
    ),
]

root = Path(__file__).resolve().parents[1]
output = root / ".runtime" / "sample-recordings"
output.mkdir(parents=True, exist_ok=True)
base = os.environ.get("CSI_API_URL", "http://127.0.0.1:8086") + "/api/v1"
with httpx.Client(base_url=base, timeout=60, trust_env=False) as client:

    def post(path, **kwargs):
        csrf = client.get("/auth/csrf").json()
        headers = kwargs.pop("headers", {})
        headers[csrf["headerName"]] = csrf["token"]
        response = client.post(path, headers=headers, **kwargs)
        response.raise_for_status()
        return response.json()

    post(
        "/auth/login",
        json={
            "tenant": os.environ["BOOTSTRAP_TENANT"],
            "email": os.environ["BOOTSTRAP_EMAIL"],
            "password": os.environ["BOOTSTRAP_PASSWORD"],
        },
    )
    imported = []
    for index, (title, department, agent, customer, days, customer_text, agent_text) in enumerate(
        SCENARIOS, 1
    ):
        target = output / f"support-{index}.wav"
        if not target.exists():
            tracks = []
            for voice, text in [("Samantha", customer_text), ("Daniel", agent_text)]:
                speech_file = output / f"{index}-{voice}.aiff"
                subprocess.run(["say", "-v", voice, "-r", "165", "-o", str(speech_file), text], check=True)
                wave, rate = sf.read(speech_file, dtype="float32")
                tracks.append(resample_poly(wave, 16000, rate))
            silence = np.zeros(8000, dtype=np.float32)
            left = np.concatenate([tracks[0], silence, np.zeros_like(tracks[1])])
            right = np.concatenate([np.zeros_like(tracks[0]), silence, tracks[1]])
            sf.write(target, np.column_stack([left, right]), 16000, subtype="PCM_16")
        metadata = dict(
            title=title,
            sample=True,
            customerId=f"sample-customer-{customer}",
            agent=agent,
            department=department,
            recordedAt=(datetime.now(timezone.utc) - timedelta(days=days, hours=index)).isoformat(),
            language="en",
            speakers=2,
            customerChannel=0,
        )
        with target.open("rb") as audio:
            result = post(
                "/calls/import",
                headers={"Idempotency-Key": f"csi-readable-samples-v1-{index}"},
                files={
                    "metadata": ("metadata.json", json.dumps(metadata), "application/json"),
                    "audio": (target.name, audio, "audio/wav"),
                },
            )
        imported.append(result["id"])
        print(f"Imported sample {index}: {title}", flush=True)
    deadline = time.monotonic() + 1800
    pending = set(imported)
    while pending and time.monotonic() < deadline:
        for call_id in list(pending):
            response = client.get(f"/calls/{call_id}")
            response.raise_for_status()
            call = response.json()
            if call["status"] == "FAILED":
                raise RuntimeError(f"Sample processing failed: {call['error_code']}")
            if call["status"] == "COMPLETED":
                pending.remove(call_id)
                print(f"Ready: {call['metadata']['title']}", flush=True)
        if pending:
            time.sleep(5)
    if pending:
        raise TimeoutError("Sample recordings are still processing. Check the import history.")
    print(f"All {len(imported)} sample recordings completed through the local pipeline.", flush=True)
