import time

import httpx

from .config import settings


def chat(messages: list[dict], temperature: float = 0.2, max_tokens: int = 900,
         json_mode: bool = False) -> str:
    """Appel à n'importe quelle API compatible OpenAI (Groq, OpenRouter, Mistral...)."""
    payload = {
        "model": settings.llm_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    url = settings.llm_base_url.rstrip("/") + "/chat/completions"

    last = None
    for attempt in range(4):
        r = httpx.post(url, json=payload, headers=headers, timeout=120)
        if r.status_code == 400 and json_mode and "response_format" in payload:
            payload.pop("response_format")  # certains fournisseurs ne gèrent pas le mode JSON
            continue
        if r.status_code in (429, 500, 502, 503):  # quotas gratuits : on patiente
            last = r
            time.sleep(2 * (attempt + 1))
            continue
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    if last is not None:
        last.raise_for_status()
    raise RuntimeError("Échec de l'appel LLM")
