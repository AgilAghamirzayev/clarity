"""Download public weights during setup. Inference runs with Hugging Face offline mode."""

import argparse
import json
import os
from pathlib import Path

from huggingface_hub import snapshot_download
from transformers import AutoConfig, AutoTokenizer

parser = argparse.ArgumentParser()
parser.add_argument(
    "--include-gliner",
    action="store_true",
    help="Provision optional GLiNER PII weights",
)
args = parser.parse_args()
root = Path(
    os.environ.get("MODEL_ROOT", str(Path(__file__).resolve().parents[1] / ".models"))
)
for repo, name in [
    ("Systran/faster-whisper-small", "whisper-small"),
    ("speechbrain/spkrec-ecapa-voxceleb", "ecapa"),
    ("urchade/gliner_multi-v2.1", "gliner"),
]:
    if name == "gliner" and not args.include_gliner:
        continue
    required = {
        "whisper-small": ["model.bin", "config.json", "tokenizer.json"],
        "ecapa": [
            "embedding_model.ckpt",
            "classifier.ckpt",
            "hyperparams.yaml",
            "label_encoder.txt",
            "mean_var_norm_emb.ckpt",
        ],
    }
    if name in required and all(
        (root / name / file).is_file() for file in required[name]
    ):
        print(f"Using existing local {name}")
        continue
    snapshot_download(
        repo,
        local_dir=root / name,
        ignore_patterns=["*.onnx", "*.msgpack", "*.h5", "*.ot", "*.wav"],
    )
print(
    "Local weights downloaded. Pull qwen3:4b-instruct and nomic-embed-text with Ollama separately."
)

if args.include_gliner:
    # GLiNER's base encoder config/tokenizer must also be cached before offline inference.

    config_path = root / "gliner/gliner_config.json"
    config = json.loads(config_path.read_text())
    encoder = config["model_name"]
    config["encoder_config"] = AutoConfig.from_pretrained(
        encoder, trust_remote_code=False
    ).to_dict()
    config_path.write_text(json.dumps(config, indent=2))
    if not (root / "gliner/tokenizer_config.json").exists():
        AutoTokenizer.from_pretrained(encoder, trust_remote_code=False).save_pretrained(
            root / "gliner"
        )
    print("Base encoder metadata and tokenizer cached for offline loading.")
