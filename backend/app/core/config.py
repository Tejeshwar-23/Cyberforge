from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CyberForge Integration Platform"
    app_env: str = "development"

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    # Bootstrap/admin credentials.
    # These remain temporarily for Docker/bootstrap recovery
    # but are NOT used by the FastAPI runtime.
    postgres_db: str
    postgres_user: str
    postgres_password: str

    # Least-privilege application account.
    postgres_runtime_user: str
    postgres_runtime_password: str

    # Schema migration account used only by Alembic.
    postgres_migration_user: str
    postgres_migration_password: str

    redis_url: str

    jwt_secret: str
    jwt_access_minutes: int = 15
    master_encryption_key: str

    sarvam_api_key: str = "CHANGE_ME"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    def _database_url(
        self,
        user: str,
        password: str,
    ) -> str:
        return (
            "postgresql+psycopg://"
            f"{quote_plus(user)}:"
            f"{quote_plus(password)}"
            f"@127.0.0.1:5432/"
            f"{quote_plus(self.postgres_db)}"
        )

    @property
    def runtime_database_url(self) -> str:
        return self._database_url(
            self.postgres_runtime_user,
            self.postgres_runtime_password,
        )

    @property
    def migration_database_url(self) -> str:
        return self._database_url(
            self.postgres_migration_user,
            self.postgres_migration_password,
        )

    # Backward-compatible alias.
    # Normal application code resolves to the restricted runtime role.
    @property
    def database_url(self) -> str:
        return self.runtime_database_url


settings = Settings()
