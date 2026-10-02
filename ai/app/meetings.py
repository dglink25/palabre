import logging
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

from psycopg.types.json import Jsonb

from . import db, pdfgen, summarizer, voice
from .config import settings

log = logging.getLogger("meetings")


def out_dir(meeting_id: str) -> Path:
    d = Path(settings.data_dir) / "meetings" / meeting_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def create(room: str, title: str | None, participants: list[str],
           recording_path: str | None, transcript: str | None) -> str:
    if recording_path:  # sécurité : uniquement dans le dossier des enregistrements Jibri
        p = Path(recording_path).resolve()
        if not p.is_relative_to(Path(settings.recordings_dir).resolve()) or not p.is_file():
            raise ValueError("recording_path invalide")
    with db.conn() as c:
        row = c.execute(
            """INSERT INTO ai_meetings (room, title, participants, transcript)
               VALUES (%s, %s, %s, %s) RETURNING id""",
            (room, title, participants, transcript),
        ).fetchone()
    return str(row["id"])


def get(meeting_id: str) -> dict | None:
    with db.conn() as c:
        return c.execute("SELECT * FROM ai_meetings WHERE id = %s", (meeting_id,)).fetchone()


def _set(meeting_id: str, **fields) -> None:
    cols = ", ".join(f"{k} = %s" for k in fields)
    vals = [Jsonb(v) if isinstance(v, dict) else v for v in fields.values()]
    with db.conn() as c:
        c.execute(f"UPDATE ai_meetings SET {cols} WHERE id = %s", (*vals, meeting_id))


def _transcribe(recording: Path) -> str:
    """Découpe l'enregistrement en blocs de 10 min (mono 16 kHz) puis transcrit chaque bloc."""
    lines = []
    with tempfile.TemporaryDirectory() as tmp:
        pattern = str(Path(tmp) / "seg_%03d.mp3")
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(recording), "-vn", "-ac", "1", "-ar", "16000",
             "-c:a", "libmp3lame", "-b:a", "48k", "-f", "segment", "-segment_time", "600", pattern],
            check=True, capture_output=True,
        )
        for i, seg in enumerate(sorted(Path(tmp).glob("seg_*.mp3"))):
            res = voice.stt(seg.read_bytes(), seg.name)
            offset = i * 600
            for s in res.get("segments", []):
                t = int(offset + s["start"])
                lines.append(f"[{t // 60:02d}:{t % 60:02d}] {s['text'].strip()}")
    return "\n".join(lines)


def process(meeting_id: str, recording_path: str | None) -> None:
    """Tâche de fond : transcription -> résumé -> PDF -> audio."""
    try:
        m = get(meeting_id)
        transcript = m["transcript"]
        if not transcript:
            if not recording_path:
                raise ValueError("ni transcription ni enregistrement fournis")
            if not voice.enabled():
                raise RuntimeError("service voix non configuré (VOICE_SERVICE_URL)")
            _set(meeting_id, status="transcribing")
            transcript = _transcribe(Path(recording_path))
            _set(meeting_id, transcript=transcript)

        _set(meeting_id, status="summarizing")
        date = m["created_at"].strftime("%d/%m/%Y")
        title = m["title"] or m["room"]
        data = summarizer.summarize(transcript, title, m["room"], m["participants"], date)
        text = summarizer.to_text(data, date, m["participants"])

        d = out_dir(meeting_id)
        (d / "resume.txt").write_text(text, encoding="utf-8")
        pdfgen.build_pdf(str(d / "compte_rendu.pdf"), data, date, m["room"], m["participants"])
        _set(meeting_id, summary=data, summary_text=text, pdf_path=str(d / "compte_rendu.pdf"))

        if voice.enabled():
            _set(meeting_id, status="synthesizing")
            (d / "resume.wav").write_bytes(voice.tts(summarizer.to_spoken(data)))
            _set(meeting_id, audio_path=str(d / "resume.wav"))
        _set(meeting_id, status="done")
    except Exception as e:  # noqa: BLE001
        log.exception("meeting %s", meeting_id)
        _set(meeting_id, status="error", error=str(e)[:500])
