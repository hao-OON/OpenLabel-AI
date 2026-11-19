"""Unified LLM adapter.

Priority: OpenAI-compatible endpoint when LLM_API_KEY is configured;
otherwise a deterministic local heuristic so the product is usable offline.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

import httpx

from ..config import settings

POSITIVE_WORDS = {
    "好", "很好", "好看", "漂亮", "满意", "喜欢", "推荐", "不错", "优秀", "赞",
    "great", "good", "love", "excellent", "amazing", "perfect", "recommend", "nice",
}
NEGATIVE_WORDS = {
    "差", "很差", "太差", "不好", "难看", "失望", "垃圾", "退货", "卡顿", "发热",
    "bad", "poor", "hate", "terrible", "awful", "broken", "slow", "worst", "disappointed",
}


@dataclass
class LLMResult:
    label: str
    confidence: float
    reason: str


def _build_prompt(text: str, labels: list[str], custom_prompt: str | None) -> list[dict]:
    label_text = ", ".join(labels)
    system = custom_prompt or (
        "You are a text classification engine. Return ONLY compact JSON with keys "
        '"label", "confidence" (0-1), "reason" (short).'
    )
    user = f"Classify the text into one of these labels: {label_text}.\nText: {text}"
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _parse_llm_json(raw: str, labels: list[str]) -> LLMResult | None:
    match = re.search(r"\{.*\}", raw, re.S)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None

    label = str(data.get("label", "")).strip()
    if label not in labels:
        lowered = {l.lower(): l for l in labels}
        label = lowered.get(label.lower(), "")
    if not label:
        return None
    try:
        confidence = float(data.get("confidence", 0.7))
    except (TypeError, ValueError):
        confidence = 0.7
    confidence = max(0.0, min(1.0, confidence))
    return LLMResult(label=label, confidence=confidence, reason=str(data.get("reason", ""))[:500])


def _heuristic(text: str, labels: list[str]) -> LLMResult:
    lowered = text.lower()
    pos_hits = [w for w in POSITIVE_WORDS if w in lowered]
    neg_hits = [w for w in NEGATIVE_WORDS if w in lowered]
    pos_score, neg_score = len(pos_hits), len(neg_hits)

    if pos_score == 0 and neg_score == 0:
        label = "neutral" if "neutral" in labels else labels[0]
        return LLMResult(label=label, confidence=0.45, reason="no sentiment keywords matched")

    # 按得分高低从候选标签中选一个，避免硬编码 positive/negative 在自定义标签下失效
    candidates = ["positive", "negative"] if pos_score > neg_score else ["negative", "positive"]
    label = next((c for c in candidates if c in labels), None)
    if label is None:
        # 自定义标签体系：正向取首个标签，负向取末个标签
        label = labels[0] if pos_score > neg_score else labels[-1]
    total = pos_score + neg_score
    confidence = 0.5 + 0.45 * (abs(pos_score - neg_score) / total)
    hits = pos_hits if pos_score > neg_score else neg_hits
    return LLMResult(
        label=label,
        confidence=round(confidence, 2),
        reason="keywords: " + ", ".join(hits[:3]),
    )


_client: httpx.Client | None = None


def _get_client() -> httpx.Client:
    """模块级共享 Client，复用 TCP/TLS 连接，避免逐条标注时反复握手。"""
    global _client
    if _client is None:
        _client = httpx.Client(timeout=30)
    return _client


def classify(text: str, labels: list[str], custom_prompt: str | None = None) -> tuple[LLMResult, str]:
    """Returns (result, mode) where mode is 'llm' or 'heuristic'."""
    if settings.LLM_API_KEY:
        try:
            client = _get_client()
            resp = client.post(
                f"{settings.LLM_BASE_URL.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"},
                json={
                    "model": settings.LLM_MODEL,
                    "messages": _build_prompt(text, labels, custom_prompt),
                    "temperature": 0,
                },
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"]
            parsed = _parse_llm_json(raw, labels)
            if parsed:
                return parsed, "llm"
        except (httpx.HTTPError, KeyError, IndexError, ValueError):
            pass
    return _heuristic(text, labels), "heuristic"
