"""Run the Privexa test suites.

    python scripts/test.py            # backend, contract and web component tests (no services needed)
    python scripts/test.py --e2e      # also end-to-end browser tests (requires: python scripts/dev.py)

Backend `live` tests run automatically when the simulators and demo chain are up, and skip otherwise.
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = ROOT / "apps" / "api" / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
NPX = shutil.which("npx") or "npx"


def run(name: str, cmd: list[str], cwd: Path, env: dict | None = None) -> bool:
    print(f"\n==> {name}", flush=True)
    ok = subprocess.run(cmd, cwd=cwd, env={**os.environ, **(env or {})}).returncode == 0
    print(f"<== {name}: {'passed' if ok else 'FAILED'}", flush=True)
    return ok


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--e2e", action="store_true", help="also run Playwright end-to-end tests against the running stack")
    args = ap.parse_args()
    results = [
        run("Backend unit, API, authorization and integrity tests (pytest)", [str(PY), "-m", "pytest", "-q", "-p", "no:logging"], ROOT),
        run("Smart contract tests (Hardhat)", [NPX, "hardhat", "test"], ROOT / "contracts"),
        run("Web component tests (Vitest)", [NPX, "vitest", "run"], ROOT / "apps" / "web"),
    ]
    if args.e2e:
        web = ROOT / "apps" / "web"
        results.append(run("End-to-end tests (Playwright, installed Chrome)", [NPX, "playwright", "test"], web, {"NODE_PATH": str(web / "node_modules")}))
    print("\nAll suites passed." if all(results) else "\nSome suites failed.")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
