import json
from uuid import uuid4

import pytest
from csi_worker.events import parse_event


def test_event_contract_excludes_transcript_payloads():
    event = dict(
        id=str(uuid4()), tenant=str(uuid4()), resource=str(uuid4()), type="call.imported", generation=1
    )
    assert parse_event(json.dumps(event)) == event
    with pytest.raises(ValueError):
        parse_event(json.dumps({**event, "transcript": "private"}))
    with pytest.raises(ValueError):
        parse_event(json.dumps({**event, "generation": 0}))
