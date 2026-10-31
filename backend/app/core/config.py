from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CyberForge Integration Platform"
    app_env: str = "development"

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    postgres_db: str
    postgres_user: str
    postgres_password: str

    redis_url: str

    jwt_secret: str
    master_encryption_key: str

    sarvam_api_key: str = "CHANGE_ME"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:"
            f"{self.postgres_password}@127.0.0.1:5432/{self.postgres_db}"
        )


settings = Settings()
