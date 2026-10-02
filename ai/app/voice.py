"""Client du service voix (Whisper pour la transcription, TTS avec votre voix clonée)."""
import io
import re
import wave

import httpx

from .config import settings


def enabled() -> bool:
    return bool(settings.voice_service_url)


def _headers() -> dict:
    return {"X-API-Key": settings.voice_service_key} if settings.voice_service_key else {}


def stt(audio: bytes, filename: str = "audio.wav") -> dict:
    """Retourne {"text": str, "segments": [{"start", "end", "text"}]}."""
    r = httpx.post(settings.voice_service_url.rstrip("/") + "/stt",
                   files={"file": (filename, audio)}, headers=_headers(), timeout=900)
    r.raise_for_status()
    return r.json()


def _tts_once(text: str) -> bytes:
    r = httpx.post(settings.voice_service_url.rstrip("/") + "/tts",
                   json={"text": text, "language": "fr"}, headers=_headers(), timeout=300)
    r.raise_for_status()
    return r.content


def _split(text: str, max_len: int = 350) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks, cur = [], ""
    for s in sentences:
        if len(cur) + len(s) + 1 > max_len and cur:
            chunks.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        chunks.append(cur)
    return chunks


def tts(text: str) -> bytes:
    """Synthèse (texte long découpé par phrases puis recollé en un seul WAV)."""
    parts = [_tts_once(c) for c in _split(text)]
    if len(parts) == 1:
        return parts[0]
    out = io.BytesIO()
    with wave.open(io.BytesIO(parts[0]), "rb") as first:
        params = first.getparams()
    with wave.open(out, "wb") as w:
        w.setparams(params)
        for p in parts:
            with wave.open(io.BytesIO(p), "rb") as r:
                w.writeframes(r.readframes(r.getnframes()))
    return out.getvalue()
