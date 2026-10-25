from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_mode: str = "local"
    database_url: str = "sqlite:///./data/umconto.db"
    supabase_url: str = ""
    supabase_anon_key: str = ""
    ai_enabled: bool = False
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    ai_max_output_tokens: int = 1800
    search_enabled: bool = False
    brave_search_api_key: str = ""
    meta_api_version: str = ""
    meta_access_token: str = ""
    meta_ig_user_id: str = ""
    meta_workspace_id: str = ""

    def validate_runtime(self):
        if self.app_mode not in ("local", "production"):
            raise RuntimeError("APP_MODE deve ser local ou production.")
        if self.app_mode == "production":
            if not self.database_url.startswith("postgresql"):
                raise RuntimeError("Produção exige PostgreSQL.")
            if not self.supabase_url.startswith("https://") or not self.supabase_anon_key:
                raise RuntimeError("Produção exige Supabase Auth configurado.")


@lru_cache
def get_settings():
    return Settings()
