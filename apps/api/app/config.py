from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(ROOT / ".env", ".env"), extra="ignore")

    environment: str = "local"  # local | test | hosted
    database_url: str = "sqlite:///./privexa-dev.db"
    cors_origins: str = "http://localhost:5173"
    session_ttl_hours: int = 12
    cookie_secure: bool = False

    # Demo mode enables one-click demo sign-in and demo scenario endpoints.
    demo_mode: bool = True
    demo_password: str = "privexa-demo"

    hospital_a_fhir_url: str = "http://localhost:8081/fhir"
    hospital_b_fhir_url: str = "http://localhost:8082/fhir"
    fhir_timeout_seconds: float = 4.0
    fhir_max_retries: int = 2

    chain_rpc_url: str = "http://localhost:8545"
    anchor_contract_address: str = ""
    anchor_deployment_file: str = str(ROOT / "contracts" / "deployments" / "localhost.json")
    anchor_private_key: str = ""  # optional; when empty the node's first unlocked account is used (local dev chains only)
    anchor_enabled: bool = True
    anchor_worker: bool = True  # background thread that anchors pending events (disabled in tests)

    contact_webhook_url: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    contact_to: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
