import json
import re

from . import llm

CHUNK_CHARS = 12000


def _chunks(text: str) -> list[str]:
    out, cur = [], ""
    for line in text.splitlines():
        if len(cur) + len(line) > CHUNK_CHARS and cur:
            out.append(cur)
            cur = ""
        cur += line + "\n"
    if cur.strip():
        out.append(cur)
    return out


def _parse_json(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.S)
        if m:
            return json.loads(m.group(0))
        raise


def summarize(transcript: str, title: str, room: str, participants: list[str], date: str) -> dict:
    parts = _chunks(transcript)
    if len(parts) > 1:  # map : notes par bloc
        notes = []
        for i, p in enumerate(parts, 1):
            notes.append(llm.chat([
                {"role": "system", "content": "Tu prends des notes fidèles de réunion en français."},
                {"role": "user", "content":
                    f"Voici la partie {i}/{len(parts)} de la transcription. Liste les sujets abordés, "
                    f"les décisions, les actions (qui/quoi/quand) et les chiffres importants. "
                    f"N'invente rien.\n\n{p}"},
            ], max_tokens=1200))
        material = "\n\n".join(notes)
    else:
        material = transcript

    prompt = f"""À partir du contenu ci-dessous d'une visioconférence, produis un compte rendu institutionnel.
Réponds UNIQUEMENT avec un objet JSON de cette forme :
{{"titre": str, "resume": str (5 à 8 phrases), "points_cles": [str], "decisions": [str],
  "actions": [{{"responsable": str, "tache": str, "echeance": str}}]}}
Utilise "Non précisé" quand une information manque. N'invente rien.

Salle : {room} | Titre indicatif : {title} | Date : {date}
Participants connus : {", ".join(participants) or "non renseignés"}

CONTENU :
{material}"""
    raw = llm.chat([{"role": "user", "content": prompt}], temperature=0.1, max_tokens=2000, json_mode=True)
    data = _parse_json(raw)
    data.setdefault("titre", title or room)
    for k in ("points_cles", "decisions", "actions"):
        data.setdefault(k, [])
    data.setdefault("resume", "")
    return data


def to_text(d: dict, date: str, participants: list[str]) -> str:
    lines = [d["titre"], f"Date : {date}"]
    if participants:
        lines.append("Participants : " + ", ".join(participants))
    lines += ["", "RÉSUMÉ", d["resume"], "", "POINTS CLÉS"] + [f"- {x}" for x in d["points_cles"]]
    lines += ["", "DÉCISIONS"] + [f"- {x}" for x in d["decisions"]]
    lines += ["", "ACTIONS"] + [
        f"- {a.get('responsable', '?')} : {a.get('tache', '')} (échéance : {a.get('echeance', 'Non précisé')})"
        for a in d["actions"]
    ]
    return "\n".join(lines)


def to_spoken(d: dict) -> str:
    """Version adaptée à l'oral (phrases courtes, pas de puces)."""
    s = [f"Résumé de la réunion : {d['titre']}.", d["resume"]]
    if d["decisions"]:
        s.append("Décisions prises. " + " ".join(f"{x}." if not x.endswith(".") else x for x in d["decisions"]))
    if d["actions"]:
        s.append("Actions à mener. " + " ".join(
            "{} doit {}.".format(a.get("responsable", "Quelqu'un"), a.get("tache", "")) for a in d["actions"]))
    return " ".join(s)
