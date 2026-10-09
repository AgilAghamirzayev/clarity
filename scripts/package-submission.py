#!/usr/bin/env python3
"""Package the current source and judging evidence, including untracked work."""

import argparse
import hashlib
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIES = (
    "src",
    "public",
    "server/src",
    "worker/csi_worker",
    "worker/tests",
    "scripts",
    "infra",
    "docs",
    "evaluation",
    "demo",
    ".github",
    "deliverables/judge-pitch/evidence",
)
FILES = (
    "README.md",
    "package.json",
    "package-lock.json",
    "index.html",
    "vite.config.ts",
    "vitest.config.ts",
    "playwright.config.ts",
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "compose.yml",
    "compose.vps.yml",
    ".env.example",
    ".gitignore",
    ".dockerignore",
    ".prettierignore",
    "server/pom.xml",
    "server/Dockerfile",
    "worker/pyproject.toml",
    "worker/uv.lock",
    "worker/Dockerfile",
    "deliverables/judge-pitch/README.md",
    "deliverables/judge-pitch/Clarity-Judge-Pitch-Current.pptx",
)
EXCLUDED = {
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    "node_modules",
    ".venv",
    ".git",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    output = (
        args.output
        or ROOT / "deliverables/submission" / f"Clarity-{now:%Y%m%d-%H%M%S}.zip"
    )
    paths = {ROOT / name for name in FILES if (ROOT / name).is_file()}
    for name in (*DIRECTORIES, "tests"):
        paths.update(p for p in (ROOT / name).rglob("*") if p.is_file())
    selected = []
    for path in sorted(paths):
        relative = path.relative_to(ROOT)
        if (
            EXCLUDED.intersection(relative.parts)
            or path.is_symlink()
            or path.suffix in {".pyc", ".pem", ".key"}
            or (path.name.startswith(".env") and path.name != ".env.example")
        ):
            continue
        if not path.resolve().is_relative_to(ROOT):
            raise ValueError("Source resolves outside the workspace")
        selected.append(path)
    required = [
        "docs/SUBMISSION_EVIDENCE.md",
        "evaluation/RESULTS_V6.md",
        "evaluation/reports/text-heldout-v6.json",
        "deliverables/judge-pitch/Clarity-Judge-Pitch-Current.pptx",
    ]
    if any(ROOT / name not in selected for name in required):
        raise ValueError("Current judging evidence or deck is missing")
    manifest = dict(
        createdAt=now.isoformat(),
        entryPoint="README.md",
        currentEvidence="docs/SUBMISSION_EVIDENCE.md",
        source="Current working tree including untracked files; not a pushed commit",
        files={},
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in selected:
            name = path.relative_to(ROOT).as_posix()
            data = path.read_bytes()
            manifest["files"][name] = dict(
                bytes=len(data), sha256=hashlib.sha256(data).hexdigest()
            )
            info = zipfile.ZipInfo.from_file(path, arcname=name)
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED)
        archive.writestr(
            "SUBMISSION_MANIFEST.json", json.dumps(manifest, indent=2) + "\n"
        )
    print(
        json.dumps(
            dict(
                archive=str(output.resolve()),
                files=len(selected),
                bytes=output.stat().st_size,
                sha256=hashlib.sha256(output.read_bytes()).hexdigest(),
            )
        )
    )


if __name__ == "__main__":
    main()
