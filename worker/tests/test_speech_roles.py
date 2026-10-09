from types import SimpleNamespace

import numpy as np
import soundfile as sf
from csi_worker.speech import transcribe


def test_stereo_roles_are_known_only_with_channel_metadata(tmp_path, monkeypatch):
    path = tmp_path / "stereo.wav"
    sf.write(path, np.zeros((16000, 2)), 16000)

    class Whisper:
        def transcribe(self, *args, **kwargs):
            word = SimpleNamespace(start=0.0, end=0.8, word=" Hello")
            return [SimpleNamespace(words=[word])], SimpleNamespace(language="en")

    monkeypatch.setattr("csi_worker.speech.whisper", lambda: Whisper())
    known = transcribe(path, {"customerChannel": 1, "language": "en"})
    assert [s["role"] for s in known["segments"]] == ["agent", "customer"]
    assert all(s["roleSource"] == "channel-metadata" for s in known["segments"])
    unknown = transcribe(path, {"language": "en"})
    assert [s["speaker"] for s in unknown["segments"]] == ["Speaker 1", "Speaker 2"]
    assert all(s["role"] == "unknown" and s["roleSource"] == "unknown" for s in unknown["segments"])
