# Module `ai` – Palabre

## Démarrage
1. Votre Postgres doit avoir **pgvector** (image `pgvector/pgvector:pg16`).
2. `cp .env.example .env` puis renseignez `DATABASE_URL`, `API_KEY`, `LLM_API_KEY`
   (clé gratuite Groq/OpenRouter/Mistral…) et vérifiez les noms des colonnes `KB_*`.
3. `docker compose up --build ai` (voir `docker-compose.snippet.yml`).
   Les tables `ai_*` et `kb_embeddings` sont créées au démarrage ; `connaissance_base` n'est jamais modifiée,
   sauf l'insertion d'entrées **validées**.
4. Docs interactives : http://localhost:8000/docs (en-tête `X-API-Key`).

## Voix (optionnel, mode texte sans cela)
Déployez `voice_server/` sur une machine GPU, mettez votre échantillon dans `voice_server/voices/ref.wav`,
puis renseignez `VOICE_SERVICE_URL` / `VOICE_SERVICE_KEY`.

## Endpoints
| Route | Rôle |
|---|---|
| `POST /chat` | Question texte (`voice: true` => `audio_url`) |
| `POST /voice/chat` | Question en audio |
| `POST /feedback` | Note 1-5 sur une réponse (`message_id`) |
| `POST /meetings` | Lance le traitement d'une réunion Jitsi |
| `GET /meetings/{id}` + `/text` `/pdf` `/audio` | Statut et trois résumés |
| `GET /admin/candidates`, `POST .../approve|reject` | Valider les nouvelles connaissances |
| `GET /admin/negatives` | Réponses mal notées à corriger |

## Intégration Jibri
Dans le script `finalize` de Jibri, appelez :
`curl -X POST http://ai:8000/meetings -H "X-API-Key: ..." -H "Content-Type: application/json" -d '{"room":"$ROOM","recording_path":"/recordings/.../fichier.mp4"}'`
