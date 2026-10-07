import hmac
import logging
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from . import chat, db, feedback, ivr, kb, memory, meetings, rag, voice
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


# ── Modèles IVR ──────────────────────────────────────────────────────────────
class IvrGreetingIn(BaseModel):
    user_id: str | None = None


class IvrRouteIn(BaseModel):
    key: str = Field(min_length=1, max_length=1)
    user_id: str | None = None


class IvrAskIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    user_id: str | None = None
    conversation_id: str | None = None
    kb_type: str | None = None
    ivr_option: str | None = None
    voice: bool = False


# ── Modèles Knowledge Base ────────────────────────────────────────────────────
class KbEntryIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    response: str = Field(min_length=1, max_length=10000)
    type: str = "general"
    ivr_option: Optional[int] = None


class KbEntryUpdate(BaseModel):
    question:   str | None          = None
    response:   str | None          = None
    type:       str | None          = None
    ivr_option: Optional[int] | None = None
    active:     bool | None         = None
    ivr_option_set: bool            = False   # True quand ivr_option est passé explicitement (même à null)


class KbBulkImportIn(BaseModel):
    entries: list[KbEntryIn]


# ── Modèles IVR Config ────────────────────────────────────────────────────────
class IvrOptionIn(BaseModel):
    key: str = Field(min_length=1, max_length=1)
    label: str = Field(min_length=1, max_length=100)
    type: str
    description: str | None = None
    prompt: str | None = None


class IvrConfigIn(BaseModel):
    options: list[IvrOptionIn]


class AgentConfigIn(BaseModel):
    agent_name:     str | None  = None
    welcome_message: str | None = None
    fallback_message: str | None = None
    avatar_url:     str | None  = None
    voice_enabled:  bool | None = None


# ID admin interne (utilisé pour les opérations admin depuis le backend)
class AdminUserIdIn(BaseModel):
    admin_user_id: str = ""


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


# =============================================================================
# IVR - Menu vocal interactif Service Client
# =============================================================================

@app.post("/ivr/greeting")
def ivr_greeting(body: IvrGreetingIn):
    """
    Retourne le message d'accueil personnalisé et la liste des options IVR.
    Appelé quand un utilisateur ouvre le service client.
    """
    try:
        result = ivr.greeting(body.user_id)
    except Exception:
        log.exception("ivr_greeting")
        raise HTTPException(500, "Erreur lors de la génération du message d'accueil")
    return result


@app.post("/ivr/route")
def ivr_route(body: IvrRouteIn):
    """
    Traite la touche saisie par l'utilisateur dans le menu IVR.
    Retourne l'action à effectuer (chat, transfer, cancel).
    """
    result = ivr.route(body.key.strip(), body.user_id)
    return result


@app.post("/ivr/ask")
def ivr_ask(body: IvrAskIn):
    """
    Répond à la question de l'utilisateur dans le contexte IVR sélectionné.
    Filtre la base de connaissance selon le type d'option choisi.
    """
    result = ivr.ask(
        user_id         = body.user_id,
        conversation_id = body.conversation_id,
        message         = body.message,
        kb_type         = body.kb_type,
        ivr_option      = body.ivr_option,
    )
    return _with_audio(result, body.voice)


@app.get("/ivr/config")
def ivr_get_config():
    """Retourne la configuration IVR active et les paramètres de l'agent."""
    return ivr.get_full_config()


# =============================================================================
# Knowledge Base - Gestion de la base de connaissance (super-admin)
# =============================================================================

@app.get("/admin/kb/entries")
def kb_list_entries(
    type:       str | None = None,
    ivr_option: int | None = None,
    active:     bool       = True,
    search:     str | None = None,
    limit:      int        = 50,
    offset:     int        = 0,
):
    """Liste les entrées de la base de connaissance avec filtres."""
    if limit > 200:
        limit = 200
    return kb.list_entries(
        kb_type    = type,
        ivr_option = ivr_option,
        active     = active,
        search     = search,
        limit      = limit,
        offset     = offset,
    )


@app.get("/admin/kb/entries/{entry_id}")
def kb_get_entry(entry_id: int):
    """Retourne une entrée par son identifiant."""
    entry = kb.get_entry(entry_id)
    if not entry:
        raise HTTPException(404, "Entrée introuvable")
    return entry


@app.post("/admin/kb/entries", status_code=201)
def kb_create_entry(body: KbEntryIn, admin_user_id: str | None = None):
    """Crée une nouvelle entrée dans la base de connaissance."""
    try:
        return kb.create_entry(
            question   = body.question,
            response   = body.response,
            kb_type    = body.type,
            ivr_option = body.ivr_option,
            created_by = admin_user_id,
        )
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.put("/admin/kb/entries/{entry_id}")
def kb_update_entry(entry_id: int, body: KbEntryUpdate, admin_user_id: str | None = None):
    """Met à jour une entrée existante."""
    try:
        # Déterminer si ivr_option a été explicitement fourni dans le corps
        explicit_ivr = body.ivr_option is not None or body.ivr_option_set
        return kb.update_entry(
            entry_id             = entry_id,
            question             = body.question,
            response             = body.response,
            kb_type              = body.type,
            ivr_option           = body.ivr_option,
            active               = body.active,
            updated_by           = admin_user_id,
            _ivr_option_explicit = explicit_ivr,
        )
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.delete("/admin/kb/entries/{entry_id}")
def kb_delete_entry(entry_id: int):
    """Supprime une entrée de la base de connaissance."""
    deleted = kb.delete_entry(entry_id)
    if not deleted:
        raise HTTPException(404, "Entrée introuvable")
    return {"ok": True, "deleted_id": entry_id}


@app.post("/admin/kb/entries/{entry_id}/toggle")
def kb_toggle_entry(entry_id: int, active: bool, admin_user_id: str | None = None):
    """Active ou désactive une entrée sans la supprimer."""
    try:
        return kb.toggle_active(entry_id, active, admin_user_id)
    except LookupError as e:
        raise HTTPException(404, str(e))


@app.post("/admin/kb/bulk-import", status_code=201)
def kb_bulk_import(body: KbBulkImportIn, admin_user_id: str | None = None):
    """Importe plusieurs entrées en une seule opération."""
    entries = [e.model_dump() for e in body.entries]
    return kb.bulk_import(entries, admin_user_id)


@app.get("/admin/kb/stats")
def kb_stats():
    """Statistiques sur la base de connaissance."""
    return kb.stats()


# =============================================================================
# IVR Config Admin - Configuration du menu vocal et de l'agent
# =============================================================================

@app.put("/admin/ivr/agent")
def update_agent(body: AgentConfigIn, admin_user_id: str | None = None):
    """Met à jour les paramètres de l'agent IA (nom, message d'accueil, avatar…)."""
    try:
        return ivr.update_agent_config(
            admin_user_id = admin_user_id or "",
            agent_name    = body.agent_name,
            welcome_msg   = body.welcome_message,
            fallback_msg  = body.fallback_message,
            avatar_url    = body.avatar_url,
            voice_enabled = body.voice_enabled,
        )
    except Exception:
        log.exception("update_agent_config")
        raise HTTPException(500, "Erreur lors de la mise à jour de la configuration")


@app.put("/admin/ivr/config")
def update_ivr(body: IvrConfigIn, admin_user_id: str | None = None):
    """Remplace la configuration IVR active par une nouvelle version."""
    try:
        options = [opt.model_dump() for opt in body.options]
        return ivr.update_ivr_config(
            admin_user_id = admin_user_id or "",
            options       = options,
        )
    except Exception:
        log.exception("update_ivr_config")
        raise HTTPException(500, "Erreur lors de la mise à jour de la configuration IVR")
