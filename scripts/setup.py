"""One-time local setup (no Docker): Python environment, Node dependencies, contract compile, .env file.

    python scripts/setup.py
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "apps" / "api"
VENV = API / ".venv"
PY = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
NPM = shutil.which("npm")


def step(msg: str) -> None:
    print(f"\n==> {msg}")


def main() -> None:
    if sys.version_info < (3, 10):
        raise SystemExit("Python 3.10 or newer is required")
    if not NPM:
        raise SystemExit("Node.js 20+ (with npm) is required")

    step("Creating Python virtual environment (apps/api/.venv)")
    if not PY.exists():
        subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)
    subprocess.run([str(PY), "-m", "pip", "install", "-q", "--upgrade", "pip"], check=True)
    subprocess.run([str(PY), "-m", "pip", "install", "-q", "-r", str(API / "requirements-dev.txt")], check=True)

    step("Installing web dependencies (apps/web)")
    subprocess.run([NPM, "install", "--no-audit", "--no-fund"], cwd=ROOT / "apps" / "web", check=True)

    step("Installing and compiling smart contract (contracts)")
    subprocess.run([NPM, "install", "--no-audit", "--no-fund"], cwd=ROOT / "contracts", check=True)
    subprocess.run([shutil.which("npx") or "npx", "hardhat", "compile"], cwd=ROOT / "contracts", check=True)

    env = ROOT / ".env"
    if not env.exists():
        step("Creating .env from .env.example")
        env.write_text((ROOT / ".env.example").read_text())

    print("\nSetup complete. Start everything with:  python scripts/dev.py")


if __name__ == "__main__":
    main()
