# Palabre AI Service

Service d'intelligence artificielle de la plateforme Palabre.
Expose une API FastAPI utilisée exclusivement par le backend Node.js.

## Architecture

```
Frontend  -->  Backend (Node.js :4000)  -->  AI Service (FastAPI :8000)
                     |                              |
                  PostgreSQL                   PostgreSQL (tables AI)
                  Redis                        (connaissance_base, ivr_config, ...)
```

Le service AI partage la même base de données PostgreSQL que le backend.
Il lit les tables métier (`users`) et gère ses propres tables (`connaissance_base`, `ai_conversations`, `kb_embeddings`, etc.).

## Fonctionnalités

### 1. Service client vocal avec IVR

Quand un utilisateur contacte le service client, l'agent IA prend en charge l'appel avec un menu interactif (IVR) :

- Accueil personnalisé avec le nom de l'utilisateur
- Menu vocal à touches :
  - Touche 1 : Problèmes techniques
  - Touche 2 : Vidéoconférence
  - Touche 3 : Installation et organisation
  - Touche 4 : Espace développeurs
  - Touche 8 : Transfert vers un conseiller humain
  - Touche 0 : Annuler

L'agent répond aux questions via RAG (Retrieval-Augmented Generation) en cherchant dans la base de connaissance filtrée par catégorie.

### 2. Base de connaissance (RAG)

- Table `connaissance_base` : entrées question/réponse par catégorie et option IVR
- Indexation vectorielle automatique via `pgvector` (synchronisation toutes les 60 secondes)
- Re-classement des résultats selon les feedbacks utilisateurs

### 3. Résumés de visioconférences

- Transcription audio via Whisper (optionnel, nécessite le `voice_server`)
- Résumé structuré via LLM
- Génération de compte-rendu PDF

## Configuration

Copier `.env.example` en `.env` et renseigner les variables :

```bash
cp .env.example .env
```

Variables obligatoires :
- `DATABASE_URL` : connexion PostgreSQL avec pgvector
- `LLM_API_KEY` : clé API du fournisseur LLM (Groq recommandé)
- `API_KEY` : clé partagée avec le backend (doit correspondre à `AI_API_KEY` dans `backend/.env`)

## Démarrage

### Via Docker Compose (recommandé)

Depuis la racine du projet :

```bash
docker compose up --build
```

### En développement local

```bash
cd ai
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Endpoints API

Tous les endpoints requièrent l'en-tête `X-API-Key` avec la valeur de `API_KEY`.

### IVR - Service client

| Méthode | Endpoint         | Description |
|---------|-----------------|-------------|
| POST    | /ivr/greeting   | Message d'accueil + options du menu |
| POST    | /ivr/route      | Traitement de la touche saisie |
| POST    | /ivr/ask        | Question dans le contexte IVR sélectionné |
| GET     | /ivr/config     | Configuration IVR active |

### Administration (base de connaissance)

| Méthode | Endpoint                        | Description |
|---------|---------------------------------|-------------|
| GET     | /admin/kb/entries               | Liste des entrées (filtres : type, ivr_option, search) |
| GET     | /admin/kb/entries/:id           | Détail d'une entrée |
| POST    | /admin/kb/entries               | Créer une entrée |
| PUT     | /admin/kb/entries/:id           | Modifier une entrée |
| DELETE  | /admin/kb/entries/:id           | Supprimer une entrée |
| POST    | /admin/kb/entries/:id/toggle    | Activer/désactiver |
| POST    | /admin/kb/bulk-import           | Import en masse (max 500) |
| POST    | /admin/kb/sync                  | Forcer la re-indexation |
| GET     | /admin/kb/stats                 | Statistiques de la KB |
| PUT     | /admin/ivr/agent                | Modifier les paramètres de l'agent |
| PUT     | /admin/ivr/config               | Remplacer la configuration IVR |
| GET     | /admin/candidates               | Candidats en attente de validation |
| POST    | /admin/candidates/:id/approve   | Valider un candidat |
| POST    | /admin/candidates/:id/reject    | Rejeter un candidat |
| GET     | /admin/negatives                | Réponses mal notées |

### Conversation

| Méthode | Endpoint                              | Description |
|---------|---------------------------------------|-------------|
| POST    | /chat                                 | Chat libre avec l'agent |
| POST    | /voice/chat                           | Chat vocal (STT -> agent -> TTS) |
| GET     | /conversations/:id/messages           | Historique d'une conversation |
| POST    | /feedback                             | Soumettre un feedback |

### Visioconférences

| Méthode | Endpoint                | Description |
|---------|-------------------------|-------------|
| POST    | /meetings               | Créer et traiter une réunion |
| GET     | /meetings/:id           | Statut et résumé |
| GET     | /meetings/:id/text      | Compte-rendu texte |
| GET     | /meetings/:id/pdf       | Compte-rendu PDF |
| GET     | /meetings/:id/audio     | Résumé audio |

## Types de la base de connaissance

| Type           | Description | Option IVR |
|---------------|-------------|-----------|
| technique      | Problèmes techniques sur la plateforme | 1 |
| videoconference | Difficultés avec la vidéoconférence | 2 |
| installation   | Installation et création d'organisation | 3 |
| developer      | Questions développeurs | 4 |
| general        | Questions générales | null |
| facturation    | Questions de facturation | null |
| compte         | Gestion du compte | null |
| autre          | Autres sujets | null |

## Voice Server (optionnel)

Pour activer la synthèse vocale (TTS) et la transcription (STT) :

```bash
cd ai/voice_server
pip install -r requirements.txt
# Déposer un fichier audio de référence (10-30 secondes, propre) :
cp ma_voix.wav voices/ref.wav
uvicorn app:app --host 0.0.0.0 --port 7860
```

Puis dans `ai/.env` :
```
VOICE_SERVICE_URL=http://localhost:7860
VOICE_SERVICE_KEY=votre_cle_optionnelle
```
