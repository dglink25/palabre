---
inclusion: always
---

# Architecture Palabre

## Structure des services

| Service | Technologie | Port | Rôle |
|---------|-------------|------|------|
| backend | Node.js / Express | 4000 | API REST + WebSocket support |
| ai | Python / FastAPI | 8000 | Agent IA, IVR, RAG, rapports |
| postgres | pgvector/pgvector:pg16 | 5432 | Base de données principale (pgvector obligatoire) |
| redis | Redis 7 | 6379 | File d'attente, pub/sub, sessions |

## Règles absolues

- **Jamais d'emoji** dans les messages utilisateur, les réponses de l'agent AI, les rapports ou les emails. Style professionnel institutionnel uniquement.
- **Jamais de jitsi_room_name** retourné dans une réponse API cliente.
- **Chiffrement E2E** : le ciphertext des messages de support n'est jamais déchiffré côté serveur.
- Le service client (support) fonctionne **uniquement sur le serveur central**, jamais sur les tenants.
- Les rapports de session sont générés **automatiquement** à la fin de chaque appel P2P, vidéoconférence ou appel support, envoyés par email à tous les participants.
- L'image Docker postgres doit être `pgvector/pgvector:pg16` (pas `postgres:16-alpine`) car le service AI nécessite l'extension pgvector.

## Scope des fonctionnalités IA

- IVR (menu vocal interactif) : options 1-4 (technique, vidéoconférence, installation, développeurs), 8 (conseiller), 0 (annuler)
- La base de connaissance est dans la table `connaissance_base` (même BDD que le backend)
- L'admin configure KB et IVR via `/admin/knowledge` (super-admin uniquement)
- Les candidats issus des feedbacks utilisateurs sont validés manuellement dans l'onglet Candidats

## Variables d'environnement clés

```
# Backend
AI_SERVICE_URL=http://ai:8000        # URL interne du service AI
AI_API_KEY=...                       # Clé partagée (doit == API_KEY dans ai/.env)
REPORTS_DIR=/data/reports            # Dossier rapports PDF/audio

# AI
DATABASE_URL=postgresql://...        # Même BDD que le backend
API_KEY=...                          # == AI_API_KEY côté backend
LLM_API_KEY=...                      # Clé Groq/OpenRouter/Mistral
KB_TABLE=connaissance_base           # Table de la KB
```
