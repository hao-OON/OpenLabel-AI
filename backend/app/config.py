from dotenv import load_dotenv
import os

load_dotenv()


class Settings:
    PROJECT_NAME = "OpenLabel AI"
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./openlabel.db")
    CORS_ORIGINS = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
        if o.strip()
    ]

    LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    LLM_API_KEY = os.getenv("LLM_API_KEY", "")
    LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")


settings = Settings()
