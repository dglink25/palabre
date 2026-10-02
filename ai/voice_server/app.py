"""Service voix : Whisper (STT) + Chatterbox (TTS avec clonage de voix).
À héberger là où vous avez un GPU (Kaggle/Colab + tunnel pour tester, ou serveur GPU).
Placez 10 à 30 secondes de VOTRE voix, propre et sans bruit, dans voices/ref.wav
Lancement : uvicorn app:app --host 0.0.0.0 --port 7860
"""
import io
import os
import tempfile

import torch
import torchaudio as ta
from faster_whisper import WhisperModel
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

API_KEY = os.getenv("VOICE_SERVICE_KEY", "")
REF_VOICE = os.getenv("REF_VOICE", "voices/ref.wav")
device = "cuda" if torch.cuda.is_available() else "cpu"

stt_model = WhisperModel(
    os.getenv("WHISPER_MODEL", "large-v3" if device == "cuda" else "small"),
    device=device, compute_type="float16" if device == "cuda" else "int8",
)

# L'API de Chatterbox évolue : vérifiez son README pour votre version.
from chatterbox.mtl_tts import ChatterboxMultilingualTTS  # noqa: E402

tts_model = ChatterboxMultilingualTTS.from_pretrained(device=device)

app = FastAPI()


def _auth(key: str):
    if API_KEY and key != API_KEY:
        raise HTTPException(401)


class TTSIn(BaseModel):
    text: str
    language: str = "fr"


@app.post("/stt")
def stt(file: UploadFile = File(...), x_api_key: str = Header(default="")):
    _auth(x_api_key)
    with tempfile.NamedTemporaryFile(suffix=os.path.splitext(file.filename or ".wav")[1]) as tmp:
        tmp.write(file.file.read())
        tmp.flush()
        segments, _ = stt_model.transcribe(tmp.name, language="fr", vad_filter=True)
        segs = [{"start": s.start, "end": s.end, "text": s.text} for s in segments]
    return {"text": " ".join(s["text"].strip() for s in segs), "segments": segs}


@app.post("/tts")
def tts(body: TTSIn, x_api_key: str = Header(default="")):
    _auth(x_api_key)
    wav = tts_model.generate(body.text, language_id=body.language, audio_prompt_path=REF_VOICE)
    buf = io.BytesIO()
    ta.save(buf, wav.cpu(), tts_model.sr, format="wav")
    return Response(buf.getvalue(), media_type="audio/wav")
