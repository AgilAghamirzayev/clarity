"""Read MP4 audio while retaining channel attribution and bounded duration."""

import av
import numpy as np


def read_mp4_audio(path, max_seconds=3600):
    chunks = []
    samples = 0
    with av.open(str(path)) as container:
        if not container.streams.audio:
            raise ValueError("NO_AUDIO_STREAM")
        stream = container.streams.audio[0]
        channels = len(stream.codec_context.layout.channels)
        if channels not in (1, 2):
            raise ValueError("UNSUPPORTED_AUDIO_DURATION_OR_CHANNELS")
        if stream.duration is not None and float(stream.duration * stream.time_base) > max_seconds:
            raise ValueError("UNSUPPORTED_AUDIO_DURATION_OR_CHANNELS")
        resampler = av.AudioResampler(format="fltp", layout="mono" if channels == 1 else "stereo", rate=16000)

        def collect(frames):
            nonlocal samples
            for frame in frames:
                samples += frame.samples
                if samples > max_seconds * 16000:
                    raise ValueError("UNSUPPORTED_AUDIO_DURATION_OR_CHANNELS")
                chunks.append(frame.to_ndarray().T)

        for frame in container.decode(stream):
            if len(frame.layout.channels) != channels:
                raise ValueError("UNSUPPORTED_AUDIO_DURATION_OR_CHANNELS")
            frame.pts = None
            collect(resampler.resample(frame))
        collect(resampler.resample(None))
    if samples < 4800:
        raise ValueError("UNSUPPORTED_AUDIO_DURATION_OR_CHANNELS")
    return np.concatenate(chunks, axis=0), 16000
