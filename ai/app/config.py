from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    api_key: str = ""

    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_api_key: str = ""
    llm_model: str = "llama-3.3-70b-versatile"

    embedding_model: str = "BAAI/bge-m3"
    embedding_dim: int = 1024

    voice_service_url: str = ""
    voice_service_key: str = ""

    kb_table: str = "connaissance_base"
    kb_id_col: str = "id"
    kb_question_col: str = "question"
    kb_answer_col: str = "response"
    kb_type_col: str = "type"

    top_k: int = 4
    min_similarity: float = 0.40
    history_turns: int = 8
    kb_sync_seconds: int = 60
    auto_approve_votes: int = 0  # 0 = validation manuelle uniquement

    data_dir: str = "/data"
    recordings_dir: str = "/recordings"


settings = Settings()
