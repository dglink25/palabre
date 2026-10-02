import hmac
import logging
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from . import chat, db, feedback, memory, meetings, rag, voice
from .config import settings

log = logging.getLogger("ai")
AUDIO_DIR = Path(settings.data_dir) / "audio"


def _sync_loop():
    while True:
        try:
            rag.sync_kb()
        except Exception:  # noqa: BLE001
            log.exception("sync_kb")
        time.sleep(settings.kb_sync_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    db.init_schema()
    db.init_pool()
    threading.Thread(target=_sync_loop, daemon=True).start()
    if not settings.api_key:
        log.warning("API_KEY vide : l'API n'est pas protégée (OK en dev uniquement)")
    yield
    db.close_pool()


def auth(x_api_key: str = Header(default="")):
    if settings.api_key and not hmac.compare_digest(x_api_key, settings.api_key):
        raise HTTPException(401, "clé API invalide")


app = FastAPI(title="Palabre AI", lifespan=lifespan, dependencies=[Depends(auth)])


# ---------- Modèles ----------
class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    user_id: str | None = None
    conversation_id: str | None = None
    voice: bool = False


class FeedbackIn(BaseModel):
    message_id: int
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class MeetingIn(BaseModel):
    room: str
    title: str | None = None
    participants: list[str] = []
    recording_path: str | None = None  # fichier déposé par Jibri dans RECORDINGS_DIR
    transcript: str | None = None      # ou transcription déjà disponible


# ---------- Conversation ----------
def _with_audio(result: dict, want_voice: bool) -> dict:
    result["audio_url"] = None
    if want_voice and voice.enabled():
        try:
            name = f"{uuid.uuid4()}.wav"
            (AUDIO_DIR / name).write_bytes(voice.tts(result["answer"]))
            result["audio_url"] = f"/audio/{name}"
        except Exception:  # noqa: BLE001
            log.exception("tts")  # la réponse texte reste disponible
    return result


@app.get("/health")
def health():
    return {"status": "ok", "voice": voice.enabled()}


@app.post("/chat")
def chat_endpoint(body: ChatIn):
    return _with_audio(chat.answer(body.user_id, body.conversation_id, body.message), body.voice)


@app.post("/voice/chat")
def voice_chat(file: UploadFile = File(...), user_id: str | None = Form(None),
               conversation_id: str | None = Form(None)):
    """L'utilisateur parle -> Whisper -> agent -> réponse texte + audio avec votre voix."""
    if not voice.enabled():
        raise HTTPException(503, "service voix non configuré")
    text = voice.stt(file.file.read(), file.filename or "audio.wav")["text"].strip()
    if not text:
        raise HTTPException(422, "aucune parole détectée")
    result = _with_audio(chat.answer(user_id, conversation_id, text), True)
    result["transcribed_text"] = text
    return result


@app.get("/audio/{name}")
def get_audio(name: str):
    try:
        uuid.UUID(name.removesuffix(".wav"))
    except ValueError:
        raise HTTPException(404)
    p = AUDIO_DIR / name
    if not p.is_file():
        raise HTTPException(404)
    return FileResponse(p, media_type="audio/wav")


@app.get("/conversations/{conversation_id}/messages")
def conversation_messages(conversation_id: str):
    return memory.all_messages(conversation_id)


# ---------- Feedback & apprentissage ----------
@app.post("/feedback")
def post_feedback(body: FeedbackIn):
    try:
        return feedback.submit(body.message_id, body.rating, body.comment)
    except LookupError:
        raise HTTPException(404, "message introuvable")
    except FileExistsError:
        raise HTTPException(409, "feedback déjà enregistré pour ce message")


@app.post("/admin/kb/sync")
def force_sync():
    return rag.sync_kb()


@app.get("/admin/candidates")
def list_candidates(status: str = "pending"):
    return feedback.candidates(status)


@app.post("/admin/candidates/{cid}/approve")
def approve_candidate(cid: int):
    kb_id = feedback.approve(cid)
    if kb_id is None:
        raise HTTPException(404, "candidat introuvable ou déjà traité")
    rag.sync_kb()
    return {"kb_id": kb_id}


@app.post("/admin/candidates/{cid}/reject")
def reject_candidate(cid: int):
    feedback.reject(cid)
    return {"ok": True}


@app.get("/admin/negatives")
def negative_feedback(limit: int = 50):
    return feedback.negatives(limit)


# ---------- Visioconférences Jitsi ----------
@app.post("/meetings", status_code=202)
def create_meeting(body: MeetingIn, bg: BackgroundTasks):
    if not (body.recording_path or body.transcript):
        raise HTTPException(422, "recording_path ou transcript requis")
    try:
        mid = meetings.create(body.room, body.title, body.participants,
                              body.recording_path, body.transcript)
    except ValueError as e:
        raise HTTPException(400, str(e))
    bg.add_task(meetings.process, mid, body.recording_path)
    return {"meeting_id": mid, "status": "queued"}


@app.get("/meetings/{mid}")
def meeting_status(mid: str):
    m = meetings.get(mid)
    if not m:
        raise HTTPException(404)
    return {
        "id": str(m["id"]), "room": m["room"], "status": m["status"], "error": m["error"],
        "summary": m["summary"],
        "downloads": {k: f"/meetings/{mid}/{k}" for k, v in
                      (("text", m["summary_text"]), ("pdf", m["pdf_path"]), ("audio", m["audio_path"])) if v},
    }


@app.get("/meetings/{mid}/{kind}")
def meeting_file(mid: str, kind: str):
    m = meetings.get(mid)
    if not m:
        raise HTTPException(404)
    if kind == "text" and m["summary_text"]:
        return FileResponse(meetings.out_dir(mid) / "resume.txt", media_type="text/plain; charset=utf-8")
    if kind == "pdf" and m["pdf_path"]:
        return FileResponse(m["pdf_path"], media_type="application/pdf", filename="compte_rendu.pdf")
    if kind == "audio" and m["audio_path"]:
        return FileResponse(m["audio_path"], media_type="audio/wav", filename="resume.wav")
    raise HTTPException(404, "fichier non disponible (traitement en cours ?)")
