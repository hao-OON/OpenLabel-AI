from fastapi import APIRouter

from ..config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
def read_settings():
    return {
        "llm_base_url": settings.LLM_BASE_URL,
        "llm_model": settings.LLM_MODEL,
        "llm_api_key_set": bool(settings.LLM_API_KEY),
        "mode": "llm" if settings.LLM_API_KEY else "heuristic",
    }
