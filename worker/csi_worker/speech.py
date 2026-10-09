import os
from functools import lru_cache
from math import gcd
from pathlib import Path

import soundfile as sf
from scipy.signal import resample_poly


@lru_cache(maxsize=1)
def whisper():
    from faster_whisper import WhisperModel

    path = Path(os.environ["WHISPER_MODEL"])
    if not path.is_dir():
        raise RuntimeError("LOCAL_WHISPER_MODEL_MISSING")
    return WhisperModel(str(path), device="cpu", compute_type="int8", local_files_only=True, cpu_threads=4)


@lru_cache(maxsize=1)
def speaker_encoder():
    from speechbrain.inference.speaker import EncoderClassifier

    path = Path(os.environ["SPEAKER_MODEL"]).resolve()
    if not path.is_dir():
        raise RuntimeError("LOCAL_SPEAKER_MODEL_MISSING")
    return EncoderClassifier.from_hparams(
        source=str(path),
        savedir=str(path),
        overrides={"pretrained_path": str(path)},
        run_opts={"device": "cpu"},
    )


def transcribe(path, metadata):
    signal, rate = sf.read(path, dtype="float32", always_2d=True)
    duration = len(signal) / rate
    if duration > 3600 or signal.shape[1] > 2 or duration < 0.3:
        raise ValueError("UNSUPPORTED_AUDIO_DURATION_OR_CHANNELS")
    factor = gcd(rate, 16000)
    signal = resample_poly(signal, 16000 // factor, rate // factor, axis=0)
    result = []
    languages = []
    for channel in range(signal.shape[1]):
        segments, info = whisper().transcribe(
            signal[:, channel],
            language=metadata.get("language"),
            vad_filter=True,
            word_timestamps=True,
            condition_on_previous_text=False,
            beam_size=5,
        )
        languages.append(info.language)
        for segment in segments:
            # Short word-aligned windows allow speaker changes within an ASR segment.
            words = list(segment.words or [])
            groups = []
            for word in words:
                if not groups or word.end - groups[-1][0].start > 3:
                    groups.append([])
                groups[-1].append(word)
            for group in groups:
                result.append(
                    {
                        "seconds": group[0].start,
                        "end": group[-1].end,
                        "text": "".join(w.word for w in group).strip(),
                        "channel": channel,
                    }
                )
    result.sort(key=lambda s: s["seconds"])
    if not result:
        raise ValueError("NO_SPEECH_DETECTED")
    if signal.shape[1] == 2:
        for segment in result:
            customer = metadata.get("customerChannel")
            segment["speaker"] = (
                ("Customer" if segment["channel"] == customer else "Agent")
                if customer is not None
                else f"Speaker {segment['channel'] + 1}"
            )
    else:
        import torch
        from sklearn.cluster import AgglomerativeClustering

        embeddings, indices = [], []
        for i, segment in enumerate(result):
            segment["speaker"] = "Unknown speaker"
            audio = signal[int(segment["seconds"] * 16000) : int(segment["end"] * 16000), 0]
            if len(audio) >= 9600:
                with torch.no_grad():
                    embeddings.append(
                        speaker_encoder().encode_batch(torch.from_numpy(audio).unsqueeze(0)).squeeze().numpy()
                    )
                indices.append(i)
        if embeddings:
            if len(embeddings) == 1:
                labels = [0]
            else:
                count = metadata.get("speakers")
                kwargs = (
                    {"n_clusters": min(count, len(embeddings))}
                    if count
                    else {"n_clusters": None, "distance_threshold": 0.65}
                )
                labels = AgglomerativeClustering(metric="cosine", linkage="average", **kwargs).fit_predict(
                    embeddings
                )
            names = {}
            for index, label in zip(indices, labels):
                names.setdefault(int(label), f"Speaker {len(names) + 1}")
                result[index]["speaker"] = names[int(label)]
    return {
        "segments": result,
        "duration": round(duration),
        "language": languages[0],
        "diarization": "channel" if signal.shape[1] == 2 else "ecapa-clustering",
        "roleAttribution": "channel-metadata"
        if signal.shape[1] == 2 and metadata.get("customerChannel") is not None
        else "unknown",
    }
