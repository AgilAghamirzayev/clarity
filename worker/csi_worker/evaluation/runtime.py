"""Report provenance and limited local resource observations without collecting secrets."""

import hashlib
import importlib.metadata
import json
import os
import platform
import resource
import subprocess
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[3]


def digest(path):
    value = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def command(args):
    try:
        result = subprocess.run(args, capture_output=True, text=True, check=False)
    except OSError:
        return None
    return result.stdout.strip() if result.returncode == 0 else None


def manifest():
    from csi_worker.agent_profile import CONTRACT, DEFAULT_PROFILE
    from csi_worker.analysis import PROMPT_VERSION

    tags = []
    try:
        with httpx.Client(timeout=10, trust_env=False) as client:
            base = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
            from urllib.parse import urlparse

            if urlparse(base).hostname not in {
                "localhost",
                "127.0.0.1",
                "::1",
                "ollama",
                "host.docker.internal",
            }:
                raise ValueError("Evaluation is local-only")
            response = client.get(base + "/api/tags")
            response.raise_for_status()
            tags = [{"name": m["name"], "digest": m["digest"]} for m in response.json()["models"]]
    except (httpx.HTTPError, ValueError):
        pass
    return dict(
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        gitCommit=command(["git", "rev-parse", "HEAD"]),
        workingTreeDirty=bool(command(["git", "status", "--porcelain"])),
        python=platform.python_version(),
        platform=platform.platform(),
        machine=platform.machine(),
        cpu=command(["sysctl", "-n", "machdep.cpu.brand_string"])
        if platform.system() == "Darwin"
        else platform.processor(),
        logicalCPUs=os.cpu_count(),
        memoryBytes=int(command(["sysctl", "-n", "hw.memsize"]) or 0)
        if platform.system() == "Darwin"
        else None,
        packages={
            p: importlib.metadata.version(p)
            for p in ["httpx", "pydantic", "faster-whisper", "speechbrain", "torch", "numpy"]
        },
        models=tags,
        analysisModel=os.environ.get("LLM_MODEL", "qwen3:4b-instruct"),
        embeddingModel=os.environ.get("EMBEDDING_MODEL", "nomic-embed-text:latest"),
        piiBackend=os.environ.get("PII_BACKEND", "ollama"),
        piiModel=os.environ.get("PII_MODEL", os.environ.get("LLM_MODEL", "qwen3:4b-instruct")),
        skillVersion=CONTRACT["version"],
        promptVersion=PROMPT_VERSION,
        profile=DEFAULT_PROFILE,
        hashes={
            str(p.relative_to(ROOT)): digest(p)
            for p in [
                ROOT / "worker/uv.lock",
                ROOT / "server/src/main/resources/agent/skill.json",
                *sorted((ROOT / "worker/csi_worker").glob("*.py")),
                *sorted((ROOT / "worker/csi_worker/evaluation").glob("*.py")),
                *sorted((ROOT / "evaluation/cases").glob("*.json")),
            ]
        },
    )


def resources():
    usage = resource.getrusage(resource.RUSAGE_SELF)
    processes = []
    listing = command(["ps", "-axo", "pid=,rss=,comm="]) or ""
    for line in listing.splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) == 3 and "ollama" in parts[2].lower():
            processes.append(
                dict(pid=int(parts[0]), rssBytes=int(parts[1]) * 1024, executable=Path(parts[2]).name)
            )
    return dict(
        pythonLifetimePeakRSSBytes=int(usage.ru_maxrss) * (1 if platform.system() == "Darwin" else 1024),
        pythonCPUSeconds=usage.ru_utime + usage.ru_stime,
        ollamaProcessRSSSnapshot=processes,
        note="Python peak excludes Ollama and other services. Ollama RSS is a point sample, not peak memory or total system/GPU memory. CPU time excludes model server.",
    )


def write_report(path, report):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(report, indent=2) + "\n")
    temporary.replace(path)
