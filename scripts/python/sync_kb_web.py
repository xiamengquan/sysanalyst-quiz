#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Compat: sync content/kb → public/kb via node scripts/sync-kb.mjs"""
from __future__ import annotations
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
raise SystemExit(subprocess.run(["node", str(REPO / "scripts/sync-kb.mjs")], cwd=REPO).returncode)
