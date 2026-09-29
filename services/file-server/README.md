# Service File Server — Palabre

Serveur de transfert de fichiers pour la messagerie. Stocke les fichiers chiffrés côté client (AES-256-GCM) — le serveur ne voit jamais le contenu en clair.

Technologie : **Node.js** (Express + multer).

## Responsabilités

- Accepter l'upload de fichiers déjà chiffrés (photos, vidéos, documents, audio)
- Générer des URLs de téléchargement signées (TTL configurable)
- Associer chaque fichier à une conversation et un message
- Nettoyer les fichiers expirés

## Port

- HTTP : **4030**

## Configuration du .env

La majorité des variables de ce service sont déjà dans `backend/.env`. Utilisez le script :

```bash
# Depuis la racine du projet
./scripts/setup-env.sh file-server
# ou pour tous les services d'un coup :
./scripts/setup-env.sh
```

Le script génère `services/file-server/.env` automatiquement. Si le fichier existe déjà et n'est pas vide, il crée `.env.new` sans écraser.

### Variables générées automatiquement (copiées de backend/.env)

| Variable | Source dans backend/.env | Description |
|----------|--------------------------|-------------|
| `JWT_ACCESS_SECRET` | `JWT_ACCESS_SECRET` | Vérification des JWT des requêtes upload |
| `FILE_SERVER_PUBLIC_URL` | `FILE_SERVER_PUBLIC_URL` | URL communiquée aux clients dans les messages |

### Variable à configurer manuellement après génération

| Variable | Exemple | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Origines CORS autorisées pour les uploads |

Editez `services/file-server/.env` et ajustez `ALLOWED_ORIGINS` :
```env
# Développement local
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4020

# Production
ALLOWED_ORIGINS=https://palabre.votre-domaine.com
```

### Variables fixes

| Variable | Valeur | Description |
|----------|--------|-------------|
| `FILE_SERVER_PORT` | `4030` | Port HTTP |

## Démarrage

```bash
# Via Docker (inclus dans core)
./palabre.sh start core

# Logs
./palabre.sh logs file-server

# Santé
curl http://localhost:4030/health
```

## Principe de chiffrement côté client

1. Le client génère une clé AES-256-GCM aléatoire
2. Chiffre le fichier **localement** avant l'upload
3. Envoie le blob chiffré au file-server
4. Envoie la clé chiffrée (avec la clé Signal du destinataire) dans le message Signal

Le serveur stocke uniquement des octets opaques. Seul le destinataire peut déchiffrer.
