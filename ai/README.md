# Module `ai` – Assistant IA de Palabre

Service autonome (API REST, FastAPI) qui ajoute à Palabre un **assistant conversationnel texte et voix**, un **scribe de visioconférences Jitsi** et une **boucle d'amélioration continue** fondée sur les retours des utilisateurs. Il remplace le placeholder Alpine prévu à la section 49 du cahier des charges.

Tout repose sur des modèles pré-entraînés et des API gratuites ou open source. **Aucun entraînement local n'est nécessaire.**

---

## Sommaire

1. [Fonctionnalités](#1-fonctionnalités)
2. [Architecture et intégration dans Palabre](#2-architecture-et-intégration-dans-palabre)
3. [Installation](#3-installation)
4. [Configuration](#4-configuration)
5. [Référence de l'API](#5-référence-de-lapi)
6. [Fonctionnement détaillé](#6-fonctionnement-détaillé)
7. [Modèle de données](#7-modèle-de-données)
8. [Intégrations côté plateforme](#8-intégrations-côté-plateforme)
9. [Service voix](#9-service-voix)
10. [Sécurité et confidentialité](#10-sécurité-et-confidentialité)
11. [Limites connues](#11-limites-connues)
12. [Dépannage](#12-dépannage)
13. [Structure du projet](#13-structure-du-projet)

---

## 1. Fonctionnalités

### Rôle 1 – Agent conversationnel
- **RAG sur la table `connaissance_base`** (colonnes `question`, `response`, `type`) : l'agent ne répond qu'à partir des extraits retrouvés, sans inventer. S'il ne trouve rien, il le dit et propose un contact humain.
- **Mémoire de conversation** persistée en base : on peut enchaîner sur un même sujet.
- **Questions de suivi comprises** : une question comme « et pour le prix ? » est reformulée en question autonome avant la recherche.
- **Synchronisation continue** de la base de connaissance : les lignes ajoutées, modifiées ou supprimées par la plateforme sont réindexées automatiquement (toutes les 60 s par défaut). L'agent n'écrit jamais lui-même dans la table, sauf pour insérer une connaissance validée (voir rôle 3).
- **Mode texte** (`POST /chat`) et **mode voix** : l'utilisateur envoie un audio (`POST /voice/chat`), la réponse revient en texte et en audio avec **votre voix clonée**.
- **Sources citées** : chaque réponse renvoie les lignes de la base utilisées, avec leur score de similarité.

### Rôle 2 – Scribe de visioconférence Jitsi
- Reçoit un enregistrement **Jibri** (ou une transcription déjà disponible) et traite la réunion en tâche de fond.
- **Transcription** Whisper horodatée (`[mm:ss]`), découpée en blocs de 10 minutes pour supporter les longues réunions.
- **Résumé par blocs puis global** (map-reduce), structuré : résumé, points clés, décisions, plan d'actions (responsable, tâche, échéance).
- **Trois livrables** :
  1. **Texte** (`resume.txt`) ;
  2. **PDF administratif** (`compte_rendu.pdf`) avec en-tête, métadonnées, décisions, tableau d'actions et pied de page ;
  3. **Résumé vocal** (`resume.wav`) avec votre voix.
- Suivi de l'avancement par statut : `queued` → `transcribing` → `summarizing` → `synthesizing` → `done` (ou `error`).

### Rôle 3 – Apprentissage par feedback
- **Notation** 1 à 5 de chaque réponse (`POST /feedback`) : 4-5 = positif, 1-2 = négatif.
- **Re-classement adaptatif** : les lignes de connaissance qui reçoivent de bons retours remontent dans les résultats, les mal notées descendent.
- **Enrichissement contrôlé** : une réponse appréciée à une question formulée autrement est proposée comme **candidate** (`ai_kb_candidates`). Elle n'entre dans `connaissance_base` qu'après validation, manuelle ou automatique à partir d'un nombre de votes. Cela protège la base contre les erreurs et les abus.
- **File de correction** : `GET /admin/negatives` liste les réponses mal notées à relire.

> Le modèle n'est pas ré-entraîné en direct. L'amélioration porte sur la base de connaissance et le classement des résultats, ce qui est plus fiable, moins coûteux et auditable. Un fine-tuning LoRA hors ligne reste possible plus tard à partir des échanges les mieux notés.

---

## 2. Architecture et intégration dans Palabre

```
 Navigateur / App Palabre
        │  (jamais d'appel direct : la clé API reste côté serveur)
        ▼
 Backend Palabre ──────────────► Module ai (FastAPI, port 8000)
        │   X-API-Key                 │
        │                             ├──► PostgreSQL (même base que Palabre + pgvector)
        │                             │       • connaissance_base  (lue ; écrite seulement après validation)
        │                             │       • kb_embeddings, ai_*   (tables du module)
        │                             │
        │                             ├──► API LLM gratuite compatible OpenAI (Groq, OpenRouter, Mistral…)
        │                             ├──► Modèle d'embeddings local (bge-m3, CPU)
        │                             └──► Service voix (GPU) : Whisper + TTS voix clonée
        │
 Jitsi ► Jibri ── script finalize ──► POST /meetings (volume partagé /recordings)
```

**Principes d'intégration**
- **Appels de serveur à serveur uniquement.** Le backend Palabre appelle le module avec l'en-tête `X-API-Key`. Le navigateur ne doit jamais connaître cette clé : prévoyez des routes proxy dans votre backend (voir §8).
- **Même base PostgreSQL.** Le module crée ses propres tables (préfixe `ai_` et `kb_embeddings`) et ne modifie pas la structure de `connaissance_base`.
- **Découplage de la voix.** Les parties lourdes (Whisper, TTS) tournent dans un service séparé pouvant utiliser un GPU. Le conteneur `ai` reste léger et ne fait qu'orchestrer.
- **Volume partagé avec Jibri** pour récupérer les enregistrements sans transfert réseau.

---

## 3. Installation

### Prérequis
- PostgreSQL **avec l'extension pgvector** (image `pgvector/pgvector:pg16`, ou extension installée sur votre image actuelle ; le module exécute `CREATE EXTENSION IF NOT EXISTS vector`, ce qui demande les droits suffisants).
- Une clé API gratuite chez un fournisseur LLM compatible OpenAI.
- Environ 3 Go de disque pour l'image et le modèle d'embeddings (téléchargé au premier démarrage).

### Étapes
1. Lire le contenu de ai/.
2. `cp .env.example .env` et renseignez au minimum `DATABASE_URL`, `API_KEY`, `LLM_API_KEY`. Vérifiez les noms de colonnes `KB_*` (§4).
3. Fusionnez `docker-compose.snippet.yml` dans le `docker-compose.yml` de Palabre (service `ai`, volumes `ai_data` et enregistrements Jibri).
4. `docker compose up --build ai`
5. Vérifiez : `curl -H "X-API-Key: <clé>" http://localhost:8000/health` → `{"status":"ok","voice":false}`. La documentation interactive est sur `/docs`.

Au démarrage, le module crée les tables, lance la première indexation de la base de connaissance et démarre la synchronisation périodique. Le premier démarrage est lent à cause du téléchargement du modèle d'embeddings ; le volume `ai_data` (`HF_HOME=/data/hf`) le conserve ensuite.

---

## 4. Configuration

Toutes les variables se placent dans `.env`.

| Variable | Défaut | Rôle |
|---|---|---|
| `DATABASE_URL` | – | Connexion PostgreSQL (obligatoire) |
| `API_KEY` | vide | Clé attendue dans `X-API-Key`. **Vide = API ouverte (dev uniquement)** |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` | Endpoint compatible OpenAI |
| `LLM_API_KEY` | – | Clé du fournisseur LLM |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Modèle utilisé (à adapter au fournisseur) |
| `EMBEDDING_MODEL` | `BAAI/bge-m3` | Modèle d'embeddings (multilingue, bon en français) |
| `EMBEDDING_DIM` | `1024` | Dimension du modèle. **À changer en même temps que le modèle**, et à recréer `kb_embeddings` si elle change |
| `VOICE_SERVICE_URL` | vide | URL du service voix. Vide = mode texte |
| `VOICE_SERVICE_KEY` | vide | Clé envoyée au service voix |
| `KB_TABLE` | `connaissance_base` | Table de connaissances |
| `KB_ID_COL` | `id` | Clé primaire (entier attendu) |
| `KB_QUESTION_COL` | `question` | Colonne question |
| `KB_ANSWER_COL` | `response` | Colonne réponse (**adaptez-la si votre colonne s'appelle `responses`**) |
| `KB_TYPE_COL` | `type` | Colonne type |
| `TOP_K` | `4` | Nombre d'extraits fournis au LLM |
| `MIN_SIMILARITY` | `0.40` | Similarité minimale pour retenir un extrait |
| `HISTORY_TURNS` | `8` | Échanges conservés dans le contexte |
| `KB_SYNC_SECONDS` | `60` | Période de resynchronisation de l'index |
| `AUTO_APPROVE_VOTES` | `0` | Votes positifs nécessaires pour valider automatiquement une candidate (0 = validation manuelle) |
| `DATA_DIR` | `/data` | Audio, PDF, cache des modèles |
| `RECORDINGS_DIR` | `/recordings` | Seul dossier d'où l'on accepte un enregistrement |

---

## 5. Référence de l'API

Toutes les routes exigent l'en-tête `X-API-Key` (y compris `/health`, ce qui compte pour un `healthcheck` Docker).

### Conversation
| Méthode | Route | Description |
|---|---|---|
| POST | `/chat` | Question texte. Corps : `message`, `user_id?`, `conversation_id?`, `voice?` |
| POST | `/voice/chat` | Question audio (multipart : `file`, `user_id?`, `conversation_id?`). Renvoie aussi `transcribed_text` |
| GET | `/audio/{name}` | Récupère une réponse audio générée |
| GET | `/conversations/{id}/messages` | Historique complet |

Exemple :
```bash
curl -X POST http://ai:8000/chat \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"message":"Comment créer un compte ?","user_id":"42","voice":true}'
```
Réponse :
```json
{
  "conversation_id": "7c0f…",
  "message_id": 118,
  "answer": "Pour créer un compte, …",
  "sources": [{"kb_id": 12, "question": "Comment m'inscrire ?", "similarity": 0.83}],
  "audio_url": "/audio/5e1b….wav"
}
```
Pour continuer la discussion, renvoyez le même `conversation_id`. `audio_url` vaut `null` si la voix est désactivée ou indisponible (la réponse texte est toujours fournie).

### Feedback et apprentissage
| Méthode | Route | Description |
|---|---|---|
| POST | `/feedback` | `message_id`, `rating` (1-5), `comment?`. 409 si le message a déjà été noté |
| GET | `/admin/candidates?status=pending` | Connaissances proposées (`pending`, `approved`, `rejected`) |
| POST | `/admin/candidates/{id}/approve` | Insère dans `connaissance_base` et réindexe |
| POST | `/admin/candidates/{id}/reject` | Rejette |
| GET | `/admin/negatives?limit=50` | Réponses notées 1-2 à corriger |
| POST | `/admin/kb/sync` | Force la resynchronisation de l'index |

### Visioconférences
| Méthode | Route | Description |
|---|---|---|
| POST | `/meetings` | Lance le traitement (202). Corps : `room`, `title?`, `participants?`, et **`recording_path` ou `transcript`** |
| GET | `/meetings/{id}` | Statut, résumé structuré, liens de téléchargement |
| GET | `/meetings/{id}/text` | Résumé texte |
| GET | `/meetings/{id}/pdf` | Compte rendu PDF |
| GET | `/meetings/{id}/audio` | Résumé vocal |

### Divers
`GET /health` renvoie l'état du service et si la voix est active.

---

## 6. Fonctionnement détaillé

### 6.1 Réponse à une question
1. Récupération des `HISTORY_TURNS × 2` derniers messages de la conversation.
2. S'il y a un historique, la question est **reformulée en question autonome** par le LLM.
3. Recherche vectorielle (similarité cosinus, index HNSW) parmi les questions de la base. On récupère `3 × TOP_K` candidats au-dessus de `MIN_SIMILARITY`.
4. **Re-classement** par feedback : `score = similarité + 0,15 × (👍 − 👎) / (👍 + 👎 + 3)`. On garde les `TOP_K` meilleurs.
5. Le LLM reçoit les consignes (concis, uniquement à partir des extraits, honnête si l'info manque), les extraits et l'historique.
6. Le message de l'utilisateur et la réponse sont enregistrés avec les `kb_id` utilisés et des métadonnées (question reformulée, similarité maximale, réponse appuyée ou non sur la base).
7. Si la voix est demandée, la réponse est synthétisée avec la voix clonée.

### 6.2 Synchronisation de la base de connaissance
Un thread d'arrière-plan compare, toutes les `KB_SYNC_SECONDS`, l'empreinte (hash) de chaque ligne de `connaissance_base` avec celle de l'index. Seules les lignes **nouvelles ou modifiées** sont ré-embeddées, et les lignes supprimées sont retirées de l'index. C'est l'index qui est « appris » ; la table d'origine n'est jamais modifiée par cette étape. Seule la **question** est vectorisée, la réponse est restituée telle quelle.

### 6.3 Cycle d'amélioration
```
Réponse ──► note 1-5
             ├─ 4-5 : +1 sur les lignes utilisées
             │        └─ si appuyée sur la base ET similarité < 0,85
             │             → candidate (nouvelle formulation de question)
             │               → validation admin (ou auto après N votes)
             │               → insertion dans connaissance_base → réindexation
             └─ 1-2 : −1 sur les lignes utilisées
                      └─ listée dans /admin/negatives pour correction humaine
```
Une réponse où l'agent a dit ne pas savoir n'est **jamais** proposée comme candidate. Une note de 3 est neutre.

### 6.4 Traitement d'une réunion
1. `POST /meetings` crée l'entrée et répond immédiatement (202) ; le travail se fait en tâche de fond.
2. Si un enregistrement est fourni : extraction audio avec ffmpeg (mono, 16 kHz), découpage en blocs de 10 minutes, transcription de chaque bloc par le service voix, assemblage avec horodatage global.
3. Si une transcription est fournie directement, cette étape est sautée (le service voix n'est alors pas nécessaire pour le texte et le PDF).
4. Résumé : notes par bloc de 12 000 caractères si la transcription est longue, puis synthèse finale au format JSON.
5. Génération de `resume.txt` et `compte_rendu.pdf`, puis de `resume.wav` si la voix est configurée.
6. Statut `done`, ou `error` avec le message d'erreur.

Les fichiers sont stockés dans `DATA_DIR/meetings/<id>/`.

---

## 7. Modèle de données

Créé automatiquement au démarrage (`sql/schema.sql`, idempotent).

| Table | Contenu |
|---|---|
| `kb_embeddings` | Vecteur de chaque ligne de `connaissance_base` + empreinte de contenu |
| `ai_kb_stats` | Votes positifs et négatifs cumulés par ligne de connaissance |
| `ai_conversations` | Conversations (`user_id`, date) |
| `ai_messages` | Messages utilisateur et assistant, `used_kb_ids`, métadonnées (`meta` JSONB) |
| `ai_feedback` | Note et commentaire, un seul par message |
| `ai_kb_candidates` | Connaissances proposées : question, réponse, votes, statut |
| `ai_meetings` | Réunions : statut, transcription, résumé JSON, texte, chemins PDF et audio |

---

## 8. Intégrations côté plateforme

### 8.1 Backend Palabre → module `ai`
Exposez des routes protégées par l'authentification de vos utilisateurs, qui relaient vers le module avec la clé API. Exemple générique (JavaScript) :

```js
// Route backend : POST /api/assistant/chat  (utilisateur déjà authentifié)
const r = await fetch("http://ai:8000/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-API-Key": process.env.AI_API_KEY },
  body: JSON.stringify({
    message: req.body.message,
    conversation_id: req.body.conversationId,
    user_id: String(req.user.id),
    voice: req.body.voice === true,
  }),
});
res.json(await r.json());
```
Faites de même pour `/voice/chat`, `/feedback` et le téléchargement des fichiers (`/audio/…`, `/meetings/…`), car le navigateur ne peut pas envoyer l'en-tête `X-API-Key` sans exposer la clé. Réservez les routes `/admin/*` à vos administrateurs.

### 8.2 Interface utilisateur
- **Chat** : zone de saisie, bouton micro (enregistrement avec `MediaRecorder`, envoi à `/voice/chat`), lecture de `audio_url`.
- **Feedback** : boutons 👍/👎 (ou étoiles) sous chaque réponse, envoyant `message_id` et la note.
- **Administration** : écran listant `/admin/candidates` (valider/rejeter) et `/admin/negatives` (réponses à corriger).
- **Réunions** : page d'une réunion affichant le statut (interrogez `GET /meetings/{id}`) puis les liens texte, PDF et audio.

### 8.3 Jitsi / Jibri
1. Montez **le même volume** d'enregistrements dans Jibri (en écriture) et dans `ai` (en lecture seule, sur `/recordings`).
2. Dans le script `finalize` de Jibri, appelez le module quand l'enregistrement est terminé. Exemple à adapter à votre version de Jibri :

```bash
#!/bin/bash
# Jibri passe en argument le dossier de la session d'enregistrement
SESSION_DIR="$1"
FILE=$(ls "$SESSION_DIR"/*.mp4 | head -n1)
ROOM=$(jq -r '.meeting_url' "$SESSION_DIR/metadata.json" 2>/dev/null | awk -F/ '{print $NF}')
# Les chemins vus par Jibri et par le module diffèrent : adaptez cette substitution à vos montages
AI_PATH=$(echo "$FILE" | sed 's#^/config/recordings#/recordings#')

curl -s -X POST http://ai:8000/meetings \
  -H "X-API-Key: $AI_API_KEY" -H "Content-Type: application/json" \
  -d "{\"room\":\"${ROOM:-inconnue}\",\"recording_path\":\"$AI_PATH\"}"
```
3. Pour les participants, transmettez la liste depuis votre plateforme via le champ `participants` si vous voulez qu'elle figure dans le PDF. Le backend peut aussi appeler directement `POST /meetings` à la fin d'une session.

Si vous disposez déjà d'une transcription (par exemple via Jigasi), envoyez-la dans `transcript` au lieu de `recording_path`.

---

## 9. Service voix

Le dossier `voice_server/` contient un service FastAPI séparé, à héberger sur une machine **avec GPU** :
- `POST /stt` : transcription avec `faster-whisper` (français, détection d'activité vocale), renvoie le texte et les segments horodatés.
- `POST /tts` : synthèse avec **Chatterbox multilingue** et votre voix de référence.

Mise en place :
1. Enregistrez **10 à 30 secondes de votre voix**, propres et sans bruit de fond, dans `voice_server/voices/ref.wav`.
2. Installez `requirements.txt` et lancez `uvicorn app:app --host 0.0.0.0 --port 7860`.
3. Renseignez `VOICE_SERVICE_URL` et `VOICE_SERVICE_KEY` dans le `.env` du module `ai`.

Les hébergements gratuits de type Hugging Face Spaces sont en CPU uniquement. Pour tester gratuitement, utilisez Kaggle ou Colab avec un tunnel (cloudflared) ; ils ne conviennent pas à un service permanent. L'API de Chatterbox évolue : consultez son README si une mise à jour casse l'import ou les paramètres de `generate`.

Sans service voix, tout le reste fonctionne ; seules la voix et la transcription d'enregistrements sont indisponibles.

---

## 10. Sécurité et confidentialité

- **Clé API** obligatoire en production (`API_KEY`) ; ne l'exposez jamais au navigateur.
- **Chemins d'enregistrement** : `recording_path` n'est accepté que s'il se trouve dans `RECORDINGS_DIR`.
- **Requêtes SQL** : les noms de table et de colonnes configurables sont traités comme identifiants SQL, pas concaténés.
- **Base de connaissance protégée** : aucune écriture automatique sans validation (sauf si vous activez `AUTO_APPROVE_VOTES`, à réserver à un usage maîtrisé).
- **Données personnelles** : les conversations et transcriptions sont stockées en base. Les questions et extraits envoyés au LLM transitent chez le fournisseur choisi : vérifiez ses conditions d'utilisation des données.
- **Enregistrement des réunions** : informez les participants de l'enregistrement et du traitement par IA (RGPD) avant de lancer Jibri.
- **Voix clonée** : n'utilisez que votre propre voix, ou celle d'une personne ayant donné son accord explicite.
- **Compte rendu automatique** : il est généré par IA et signalé comme tel dans le pied de page du PDF. Faites-le valider avant diffusion officielle.

---

## 11. Limites connues

- **Quotas des API gratuites** : le module réessaie en cas d'erreur 429/5xx (jusqu'à 4 tentatives) mais un fort trafic peut dépasser les quotas du fournisseur.
- **Tâches de réunion en mémoire** : si le conteneur redémarre pendant un traitement, la réunion reste dans son dernier statut ; relancez `POST /meetings`.
- **Pas d'identification des intervenants** : Jibri enregistre un audio mixé, la transcription n'attribue donc pas les propos à des personnes.
- **Mémoire de conversation par fenêtre** : seuls les `HISTORY_TURNS` derniers échanges sont repris ; il n'y a pas de résumé des plus anciens.
- **Polices du PDF** : polices standard (alphabet latin, accents français inclus). Les écritures non latines ne s'afficheront pas.
- **Fichiers audio** : ceux de `DATA_DIR/audio` ne sont pas purgés automatiquement ; prévoyez une tâche de nettoyage.
- **Index** : seule la question est vectorisée ; une réponse très pertinente mais éloignée de la formulation des questions peut être manquée.
- **Clé primaire** : `KB_ID_COL` doit être un entier.

---

## 12. Dépannage

| Symptôme | Piste |
|---|---|
| `extension "vector" is not available` | Utilisez une image Postgres avec pgvector, ou installez l'extension |
| `permission denied to create extension` | Créez l'extension une fois avec un super-utilisateur : `CREATE EXTENSION vector;` |
| `column "response" does not exist` | Corrigez `KB_ANSWER_COL` (et les autres `KB_*`) |
| Réponses toujours « je ne sais pas » | Vérifiez `POST /admin/kb/sync` (champ `indexed`), puis baissez `MIN_SIMILARITY` |
| Erreur de dimension de vecteur | `EMBEDDING_DIM` ne correspond pas au modèle ; supprimez la table `kb_embeddings` après correction |
| 401 sur toutes les routes | Absence ou erreur de l'en-tête `X-API-Key` (valable aussi pour `/health`) |
| 429 du LLM | Quota gratuit atteint : changez de fournisseur ou de modèle, ou réduisez le trafic |
| Réunion en `error` | Lisez le champ `error` de `GET /meetings/{id}` ; cas fréquents : voix non configurée, chemin hors `/recordings`, fichier introuvable |
| `audio_url` toujours `null` | `VOICE_SERVICE_URL` vide ou service voix injoignable (voir les logs du module) |
| Premier démarrage très long | Téléchargement du modèle d'embeddings ; vérifiez que `ai_data` est bien monté |

---

## 13. Structure du projet

```
ai/
├── Dockerfile                  # python:3.11-slim, ffmpeg, PyTorch CPU
├── requirements.txt
    avata.jpeg  
├── .env.example
├── docker-compose.snippet.yml  # à fusionner dans le compose de Palabre
├── sql/schema.sql              # tables du module (idempotent)
├── app/
│   ├── main.py                 # routes, authentification, démarrage
│   ├── config.py               # variables d'environnement
│   ├── db.py                   # pool PostgreSQL + pgvector
│   ├── embeddings.py           # modèle d'embeddings
│   ├── rag.py                  # synchronisation de l'index et recherche
│   ├── chat.py                 # orchestration d'une réponse
│   ├── memory.py               # historique des conversations
│   ├── llm.py                  # client LLM compatible OpenAI
│   ├── feedback.py             # notes, candidates, validation
│   ├── voice.py                # client du service voix
│   ├── meetings.py             # pipeline réunion
│   ├── summarizer.py           # résumé map-reduce, texte, version orale
│   └── pdfgen.py               # compte rendu PDF
└── voice_server/               # service Whisper + voix clonée (GPU)
    ├── app.py
    ├── requirements.txt
    └── voices/                 # ref.wav : votre échantillon de voix
```