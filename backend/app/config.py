"""Application configuration via pydantic-settings."""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "VibeScholar"
    data_root: Path = Path(__file__).resolve().parent.parent.parent
    api_prefix: str = "/api/v1"
    frontend_dist: Path = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
    host: str = "0.0.0.0"
    port: int = 8007

    @property
    def config_dir(self) -> Path:
        return self.data_root / "config"

    @property
    def projects_dir(self) -> Path:
        return self.data_root / "projects"

    @property
    def literature_dir(self) -> Path:
        return self.data_root / "data" / "literature"

    @property
    def reports_dir(self) -> Path:
        return self.data_root / "reports"

    model_config = {"env_prefix": "VIBECR_"}


settings = Settings()
