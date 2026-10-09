import av
import numpy as np
import pytest
from csi_worker.media import read_mp4_audio


def write_tone(path, channels=1):
    rate = 48000
    layout = "mono" if channels == 1 else "stereo"
    signal = np.sin(np.arange(rate) * 2 * np.pi * 440 / rate).astype("float32") * 0.1
    samples = np.stack([signal] if channels == 1 else [signal, np.zeros_like(signal)])
    with av.open(str(path), "w") as container:
        stream = container.add_stream("aac", rate=rate)
        stream.layout = layout
        frame = av.AudioFrame.from_ndarray(samples, format="fltp", layout=layout)
        frame.sample_rate = rate
        for packet in stream.encode(frame):
            container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)


@pytest.mark.parametrize("channels", [1, 2])
def test_mp4_audio_is_resampled_without_losing_channels(tmp_path, channels):
    path = tmp_path / "call.mp4"
    write_tone(path, channels)
    signal, rate = read_mp4_audio(path)
    assert rate == 16000
    assert signal.dtype == np.float32
    assert signal.shape[1] == channels
    assert 16000 <= len(signal) < 17000
    assert np.max(np.abs(signal[:, 0])) > 0.05
    if channels == 2:
        assert np.max(np.abs(signal[:, 1])) < 0.001


def test_rejects_mp4_over_duration_limit(tmp_path):
    path = tmp_path / "long.mp4"
    write_tone(path)
    with pytest.raises(ValueError, match="UNSUPPORTED_AUDIO_DURATION_OR_CHANNELS"):
        read_mp4_audio(path, max_seconds=0.5)


def test_rejects_video_without_audio(tmp_path):
    path = tmp_path / "silent.mp4"
    with av.open(str(path), "w") as container:
        stream = container.add_stream("mpeg4", rate=25)
        stream.width = stream.height = 16
        frame = av.VideoFrame.from_ndarray(np.zeros((16, 16, 3), dtype=np.uint8), format="rgb24")
        for packet in stream.encode(frame):
            container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)
    with pytest.raises(ValueError, match="NO_AUDIO_STREAM"):
        read_mp4_audio(path)
