"""Run the full Privexa demo locally — no Docker required.

    python scripts/dev.py            # start everything (Ctrl+C stops it all)
    python scripts/dev.py --no-web   # everything except the Vite dev server

Starts, in order (each is skipped if its port is already in use):
  Hospital A simulator  http://127.0.0.1:8081/fhir   (MetroCare Medical Center, fictional)
  Hospital B simulator  http://127.0.0.1:8082/fhir   (Sunrise General Hospital, fictional)
  Demo blockchain       http://127.0.0.1:8545         (Hardhat local network) + AuditAnchor deployment
  Privexa API           http://127.0.0.1:8000         (migrations + demo seed run first)
  Web app               http://localhost:5173
and loads the synthetic patient data into both hospitals (idempotent).

Prerequisites: run scripts/setup.py once.
"""

import argparse
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "apps" / "api"
WEB = ROOT / "apps" / "web"
CONTRACTS = ROOT / "contracts"
PY = API / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
NPX = shutil.which("npx") or "npx"
NPM = shutil.which("npm") or "npm"

procs: list[tuple[str, subprocess.Popen]] = []


def port_open(port: int) -> bool:
    # Vite may bind only to ::1 ("localhost" on recent Node), so probe IPv4 and IPv6.
    for family, host in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        try:
            with socket.socket(family) as s:
                s.settimeout(0.3)
                if s.connect_ex((host, port)) == 0:
                    return True
        except OSError:
            pass
    return False


def wait_port(port: int, name: str, timeout: float = 120) -> None:
    end = time.time() + timeout
    while time.time() < end:
        if port_open(port):
            return
        time.sleep(0.4)
    raise SystemExit(f"{name} did not start on port {port}")


def start(name: str, cmd: list[str], cwd: Path, port: int) -> None:
    if port_open(port):
        print(f"  - {name}: already running on :{port}")
        return
    print(f"  - {name}: starting on :{port}")
    p = subprocess.Popen(cmd, cwd=cwd, env={**os.environ, "PYTHONUNBUFFERED": "1"})
    procs.append((name, p))
    wait_port(port, name)


def run(cmd: list[str], cwd: Path) -> None:
    subprocess.run(cmd, cwd=cwd, check=True)


def shutdown(*_):
    print("\nStopping Privexa services…")
    for _, p in reversed(procs):
        if p.poll() is None:
            p.terminate()
    for _, p in procs:
        try:
            p.wait(timeout=8)
        except subprocess.TimeoutExpired:
            p.kill()
    sys.exit(0)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-web", action="store_true")
    args = ap.parse_args()
    if not PY.exists():
        raise SystemExit("Python environment not found. Run: python scripts/setup.py")
    try:
        _run(args)
    except BaseException:
        for _, p in reversed(procs):
            stop(p)
        raise


def _run(args) -> None:
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print("Privexa demo - starting services")
    start("Hospital A (MetroCare)", [str(PY), "simulator/fhir_server.py", "--name", "MetroCare Medical Center", "--port", "8081", "--db", "simulator/data/metrocare.db"], ROOT, 8081)
    start("Hospital B (Sunrise)", [str(PY), "simulator/fhir_server.py", "--name", "Sunrise General Hospital", "--port", "8082", "--db", "simulator/data/sunrise.db"], ROOT, 8082)

    fresh_chain = not port_open(8545)
    start("Demo blockchain", [NPX, "hardhat", "node", "--hostname", "127.0.0.1"], CONTRACTS, 8545)
    if fresh_chain or not (CONTRACTS / "deployments" / "localhost.json").exists():
        print("  - Deploying AuditAnchor contract")
        run([NPX, "hardhat", "run", "scripts/deploy.js", "--network", "localhost"], CONTRACTS)

    print("  - Applying database migrations and demo seed")
    run([str(PY), "-m", "alembic", "upgrade", "head"], API)
    run([str(PY), "-m", "app.seed"], API)
    start("Privexa API", [str(PY), "-m", "uvicorn", "app.main:app", "--port", "8000"], API, 8000)

    print("  - Loading synthetic patient data into both hospitals")
    run([str(PY), "simulator/seed.py"], ROOT)

    if not args.no_web:
        start("Web app", [NPM, "run", "dev", "--", "--port", "5173", "--strictPort"], WEB, 5173)

    print("\nPrivexa is running:")
    print("  Website + demo   http://localhost:5173")
    print("  API docs         http://127.0.0.1:8000/api/v1/docs")
    print("  Press Ctrl+C to stop everything started by this script.\n")
    while True:
        for name, p in procs:
            if p.poll() is not None:
                print(f"{name} exited with code {p.returncode}. Stopping.")
                shutdown()
        time.sleep(1)


if __name__ == "__main__":
    main()
