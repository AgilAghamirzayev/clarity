#!/usr/bin/env python3
"""Run a command with the local environment without printing secrets."""

import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
config = root / ".env.local"
if config.exists():
    for line in config.read_text().splitlines():
        if line and not line.startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key, value)
os.chdir(root)
if len(sys.argv) < 2:
    raise SystemExit("Usage: scripts/run.py COMMAND [ARGUMENTS]")
os.execvp(sys.argv[1], sys.argv[1:])
