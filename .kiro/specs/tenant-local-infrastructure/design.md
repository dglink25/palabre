# Design Document — Infrastructure Tenant Local Palabre

## Overview

Ce document décrit la conception technique de l'infrastructure tenant local de Palabre. Chaque organisation déploie une instance complète du service sur son propre serveur via un script d'installation unique. Le DNS (`{org}.palabre.com`) et le certificat TLS sont provisionnés automatiquement. Les applications web et mobile basculent de façon transparente entre connexion directe (réseau local) et relais via le serveur central (Internet) sans aucune action utilisateur. Le chiffrement E2E est préservé dans les deux modes : les clés privées ne quittent jamais les appareils.

---

## Architecture Système Globale

```
┌─────────────────────────────────────────────────────────────┐
│  RÉSEAU LOCAL DE L'ORGANISATION                             │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TENANT SERVER  ({org}.palabre.com → IP locale)      │  │
│  │                                                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │  │
│  │  │ Messagerie│ │  TURN/   │ │  Jitsi (white-label) │ │  │
│  │  │   E2E    │ │  Coturn  │ │  VideoConference     │ │  │
│  │  └──────────┘ └──────────┘ └──────────────────────┘ │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │  │
│  │  │  Push    │ │ Presence │ │  Tunnel Connector    │ │  │
│  │  │ Service  │ │ Service  │ │  (WireGuard/mTLS)   │ │  │
│  │  └──────────┘ └──────────┘ └──────────────────────┘ │  │
│  │                                                      │  │
│  │  Nginx (reverse proxy, TLS Let's Encrypt)            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Appareils locaux : web browser, app mobile                 │
│  → Direct_Mode : HTTP/WS direct vers le Tenant_Server       │
└─────────────────────────────────────────────────────────────┘
                           │
                     TLS Tunnel
                 (mTLS ou WireGuard)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  SERVEUR CENTRAL PALABRE  (central.palabre.com)             │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  DNS Registry│  │ Tunnel Router│  │  Version Channel │  │
│  │  (PowerDNS)  │  │  (proxy/WG)  │  │  (update notif.) │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  Appareils hors réseau → Relay_Mode : via Central_Server    │
└─────────────────────────────────────────────────────────────┘
```

### Flux Direct_Mode (réseau local)
```
Appareil → {org}.palabre.com → Nginx → Service Tenant
```

### Flux Relay_Mode (Internet)
```
Appareil → central.palabre.com/relay → Tunnel → Tenant_Server → Service Tenant
           (TLS transport)                        (chiffré E2E préservé)
```

---

## Composants du Tenant Server

### Stack déployée par l'Install_Script

```
/opt/palabre/
├── docker-compose.tenant.yml    # Orchestration de tous les services
├── nginx/
│   ├── nginx.conf               # Reverse proxy HTTPS
│   └── certs/                   # Certificats Let's Encrypt (Certbot)
├── services/
│   ├── message-router/          # Phoenix/Elixir — messagerie E2E
│   ├── presence/                # Phoenix/Elixir — présence en ligne
│   ├── file-server/             # Node.js — fichiers média
│   ├── call-signal/             # Phoenix/Elixir — signalisation appels
│   ├── jitsi/                   # Jitsi Meet (Prosody + Jicofo + JVB)
│   ├── coturn/                  # Serveur TURN/STUN
│   ├── push-service/            # Node.js — FCM/APNs
│   └── tunnel-connector/        # Agent de connexion au Central_Server
├── postgres/                    # Base de données locale
├── redis/                       # Cache et pub/sub
└── config/
    └── tenant.conf              # Configuration générée à l'installation
```

### `docker-compose.tenant.yml` — services principaux

```yaml
services:
  nginx:          # ports 80 (redirect) + 443 (HTTPS)
  postgres:       # port 5432 (interne uniquement)
  redis:          # port 6379 (interne uniquement)
  message-router: # port 4020 (via nginx)
  presence:       # port 4010 (interne)
  file-server:    # port 4030 (via nginx)
  call-signal:    # port 4040 (via nginx)
  coturn:         # ports 3478/UDP + 5349/TCP (exposés)
  jitsi-web:      # port 8080 (via nginx, white-label)
  jitsi-prosody:  # port 5222 (interne)
  jicofo:         # interne
  jvb:            # port 10000/UDP (exposé pour WebRTC SFU)
  push-service:   # port 4050 (via nginx)
  tunnel-conn:    # connexion sortante vers Central_Server
```

---

## Install_Script — Logique d'installation

### Fichier : `install.sh`

```bash
#!/bin/bash
# install.sh — Script d'installation Palabre Tenant
# Usage: curl -sSL https://install.palabre.com | bash -s -- --org=monorg --token=TOKEN
```

### Étapes d'exécution

```
1. VÉRIFICATION DES PRÉREQUIS
   ├── CPU ≥ 4 cœurs, RAM ≥ 8 Go, Disque ≥ 50 Go
   ├── OS : Ubuntu 20.04+ ou Debian 11+
   ├── Architecture : x86_64 ou ARM64
   ├── Docker Engine ≥ v24 installé
   ├── Ports disponibles : 443/TCP, 80/TCP, 3478/UDP, 5349/TCP, 10000-20000/UDP
   └── Connectivité HTTPS vers central.palabre.com
   → En cas d'échec : exit code 1/2/3/4 + message explicite

2. GÉNÉRATION DES CLÉS TENANT
   ├── Génération paire de clés asymétriques (RSA-2048 ou Ed25519)
   ├── Stockage clé privée dans /etc/palabre/keys/tenant.key (chmod 600)
   └── Extraction clé publique dans /etc/palabre/keys/tenant.pub

3. ENREGISTREMENT AUPRÈS DU CENTRAL_SERVER
   ├── POST https://central.palabre.com/api/tenants/register
   │   Body: { org_slug, public_key, ip_address, components_version }
   ├── Réception du { tenant_subdomain, registration_token }
   └── Retry : 3 tentatives avec intervalle de 30s

4. DÉPLOIEMENT DES COMPOSANTS (docker-compose up -d)
   ├── Pull des images Docker depuis registry.palabre.com
   ├── Génération de /opt/palabre/config/tenant.conf
   └── Démarrage séquentiel : postgres → redis → services → nginx

5. PROVISIONNEMENT DNS + TLS
   ├── Attente propagation DNS : polling GET {org}.palabre.com/health
   ├── Lancement Certbot pour {org}.palabre.com (ACME HTTP-01 ou DNS-01)
   └── Installation certificat dans nginx/certs/

6. VÉRIFICATION SANTÉ
   ├── Appel GET {org}.palabre.com/health → vérification statut de chaque composant
   └── Affichage du rapport final à l'Org_Admin

7. DÉMARRAGE DU TUNNEL CONNECTOR
   └── Connexion TLS mTLS vers central.palabre.com:4443
```

### Fichier de configuration généré : `tenant.conf`

```ini
# /etc/palabre/tenant.conf — permissions 600
TENANT_SUBDOMAIN=monorg.palabre.com
TENANT_ORG_ID=uuid-de-lorganisation
CENTRAL_SERVER_URL=https://central.palabre.com
CENTRAL_TUNNEL_URL=wss://central.palabre.com:4443/tunnel
TENANT_PUBLIC_KEY_PATH=/etc/palabre/keys/tenant.pub
TENANT_PRIVATE_KEY_PATH=/etc/palabre/keys/tenant.key
REGISTRATION_TOKEN=token-opaque-fourni-par-central
COMPONENTS_VERSION=1.0.0
INSTALLED_AT=2026-10-01T00:00:00Z
```

---

## Composant : DNS Registry (Central_Server)

### Technologie : PowerDNS + API REST interne

### Endpoint backend central : `POST /api/tenants/register`

```json
// Requête
{
  "org_slug": "monorg",
  "public_key": "ssh-ed25519 AAAA...",
  "ip_address": "203.0.113.45",
  "components_version": "1.0.0"
}

// Réponse 201
{
  "tenant_subdomain": "monorg.palabre.com",
  "registration_token": "opaque-token",
  "dns_ttl": 300
}
```

### Migration DB Central_Server : table `tenant_registrations`

```sql
CREATE TABLE tenant_registrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_subdomain  TEXT NOT NULL UNIQUE,  -- monorg.palabre.com
  ip_address        INET NOT NULL,
  public_key        TEXT NOT NULL,
  registration_token_hash TEXT NOT NULL,
  components_version TEXT NOT NULL DEFAULT '1.0.0',
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','suspended')),
  last_heartbeat_at TIMESTAMPTZ,
  registered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_tenant_reg_subdomain ON tenant_registrations(tenant_subdomain);
CREATE INDEX idx_tenant_reg_org ON tenant_registrations(organization_id);
```

---

## Composant : Network_Detector (Client web + mobile)

### Fichier partagé : `src/lib/networkDetector.js` (web) / `networkDetector.ts` (mobile)

```typescript
/**
 * NetworkDetector — détecte le mode de connexion et bascule si nécessaire.
 * Partagé entre web (React) et mobile (React Native).
 *
 * Direct_Mode  : connexion directe vers {org}.palabre.com
 * Relay_Mode   : connexion via central.palabre.com/relay/{org}
 */

export type ConnectionMode = 'direct' | 'relay' | 'unavailable';

export interface NetworkDetectorConfig {
  tenantUrl: string;        // https://monorg.palabre.com
  relayUrl: string;         // https://central.palabre.com/relay/monorg
  probeTimeoutMs: number;   // 3000
  probeIntervalMs: number;  // 30000 (en Relay_Mode)
  switchDelayMs: number;    // 5000 (max pour basculer)
}

export class NetworkDetector {
  private mode: ConnectionMode = 'direct';
  private probeInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: ((mode: ConnectionMode) => void)[] = [];

  // Appelé au démarrage de l'app et au retour au premier plan
  async probe(): Promise<void> { ... }

  // Retourne l'URL active selon le mode courant
  getActiveBaseUrl(): string { ... }

  // Abonnement aux changements de mode (pour l'indicateur UI)
  onModeChange(listener: (mode: ConnectionMode) => void): () => void { ... }

  // Suspend les probes périodiques (app en arrière-plan)
  suspend(): void { ... }

  // Reprend les probes périodiques (app au premier plan)
  resume(): void { ... }
}
```

### Intégration dans `apiClient.js` (web)

```javascript
// apiClient.js — utilise NetworkDetector pour choisir l'URL de base
import { networkDetector } from './networkDetector';

async function request(path, opts) {
  // L'URL de base est fournie par le NetworkDetector
  const baseUrl = networkDetector.getActiveBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, ...);
  ...
}
```

### Indicateur visuel dans `Layout.jsx`

```jsx
// Petit badge discret en bas de la sidebar
function NetworkModeIndicator() {
  const [mode, setMode] = useState(networkDetector.getCurrentMode());
  
  useEffect(() => {
    return networkDetector.onModeChange(setMode);
  }, []);
  
  if (mode === 'direct') return (
    <div className="network-badge network-badge--local">
      <span className="dot dot--green" /> Réseau local
    </div>
  );
  if (mode === 'relay') return (
    <div className="network-badge network-badge--relay">
      <span className="dot dot--orange" /> Via serveur central
    </div>
  );
  return (
    <div className="network-badge network-badge--error">
      <span className="dot dot--red" /> Hors ligne
    </div>
  );
}
```

---

## Composant : Tunnel Connector (Tenant_Server)

### Rôle
Le Tunnel Connector est un agent léger qui :
1. Maintient une connexion WebSocket TLS persistante vers le Central_Server
2. Relaie les messages entrants (depuis Internet) vers les services locaux
3. Envoie le Heartbeat toutes les 60 secondes
4. S'authentifie via mutual TLS (certificat client = clé tenant)

### Authentification mTLS

```
Tenant_Server                       Central_Server
     │                                    │
     │── TLS ClientHello ────────────────>│
     │<── TLS ServerHello + Cert ─────────│
     │── Client Certificate (tenant.crt) >│
     │<── Certificate Verified ───────────│
     │── WebSocket Upgrade ──────────────>│
     │<── 101 Switching Protocols ────────│
     │                                    │
     │── Heartbeat (every 60s) ──────────>│
     │<── ACK ────────────────────────────│
```

### Format du Heartbeat

```json
{
  "type": "heartbeat",
  "tenant_subdomain": "monorg.palabre.com",
  "timestamp": "2026-10-01T12:00:00Z",
  "components": {
    "messaging": "healthy",
    "turn": "healthy",
    "videoconference": "healthy",
    "push": "healthy",
    "presence": "healthy"
  },
  "version": "1.0.0"
}
```

---

## Sécurité E2E en mode Relay

```
Appareil A (hors réseau)                    Tenant_Server (local)
     │                                              │
     │  Message chiffré E2E :                      │
     │  encrypt(plaintext, B.publicKey) → ciphertext│
     │                                              │
     │──[TLS]──> Central_Server ──[TLS]──────────> │
     │           ↑ voit : ciphertext chiffré E2E    │
     │           ↑ ne peut PAS déchiffrer           │
     │                                              │
     │                              Tenant_Server stocke ciphertext
     │                              (Session_Key chiffrée au repos)
     │
     │  Appareil B (local ou distant) se connecte
     │  decrypt(ciphertext, B.privateKey) → plaintext
     │  (déchiffrement sur l'appareil de B uniquement)
```

**Garantie :** Le Central_Server ne voit que du ciphertext opaque. Même en mode Relay, le E2E est préservé car les clés privées ne quittent jamais les appareils.

---

## Parité Mobile (React Native)

### Modules React Native requis

```
frontend/mobile/
├── src/
│   ├── lib/
│   │   ├── networkDetector.ts      # Même logique que web
│   │   ├── apiClient.ts            # Utilise networkDetector
│   │   ├── videoconferenceApi.ts   # Mêmes wrappers que web
│   │   └── e2eStorage.ts           # Keychain iOS / Keystore Android
│   ├── services/
│   │   ├── CallService.ts          # CallKit (iOS) / ConnectionService (Android)
│   │   └── PushService.ts          # FCM + APNs
│   ├── screens/
│   │   ├── VideoConferenceScreen/
│   │   │   ├── VideoConferencePage.tsx   # Équivalent VideoConferencePage.jsx
│   │   │   └── VideoRoomPage.tsx         # Équivalent VideoRoomPage.jsx
│   │   ├── CallsScreen/
│   │   ├── MessagingScreen/
│   │   └── ContactsScreen/
│   └── components/
│       └── videoconference/
│           ├── VideoConferenceGateway.tsx  # WebView vers Jitsi (white-label)
│           ├── CreateRoomModal.tsx
│           ├── WaitingRoomPanel.tsx
│           └── RoomCard.tsx
```

### Stockage sécurisé des clés E2E

```typescript
// e2eStorage.ts
import * as Keychain from 'react-native-keychain';

export async function storePrivateKey(userId: string, privateKey: string): Promise<void> {
  await Keychain.setGenericPassword(userId, privateKey, {
    service: 'palabre-e2e-keys',
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    // iOS: kSecAttrAccessibleWhenUnlockedThisDeviceOnly (non extractable depuis iCloud)
    // Android: EncryptedSharedPreferences + Android Keystore
  });
}

export async function getPrivateKey(userId: string): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service: 'palabre-e2e-keys' });
  return credentials ? credentials.password : null;
}
```

### VideoConferenceGateway mobile (WebView)

```typescript
// VideoConferenceGateway.tsx — React Native
import { WebView } from 'react-native-webview';

// Même principe que web : le SDK Jitsi est chargé via le proxy backend
// La WebView pointe vers une page HTML locale qui instancie JitsiMeetExternalAPI
// → Aucun nom de salle Jitsi ni domaine Jitsi visible dans l'app mobile
```

---

## Variables d'environnement supplémentaires

### Sur le Tenant_Server (`/etc/palabre/tenant.conf`)

```ini
TENANT_SUBDOMAIN=monorg.palabre.com
CENTRAL_SERVER_URL=https://central.palabre.com
CENTRAL_TUNNEL_URL=wss://central.palabre.com:4443/tunnel
REGISTRATION_TOKEN=...
```

### Sur le Central_Server (`.env`)

```env
# DNS provisioning
DNS_PROVIDER=powerdns          # powerdns | cloudflare | route53
POWERDNS_API_URL=http://localhost:8053
POWERDNS_API_KEY=change_me_pdns_key
PALABRE_BASE_DOMAIN=palabre.com

# Tunnel
TUNNEL_PORT=4443
TUNNEL_HEARTBEAT_TIMEOUT_SECONDS=180

# Acme/TLS
ACME_EMAIL=admin@palabre.com
```

### Sur le client (web `VITE_*` / mobile `Config.*`)

```env
# URL du tenant — définie dynamiquement après connexion
VITE_TENANT_BASE_URL=https://monorg.palabre.com
# URL du relais (Central_Server)
VITE_RELAY_BASE_URL=https://central.palabre.com/relay
# Seuils NetworkDetector
VITE_PROBE_TIMEOUT_MS=3000
VITE_PROBE_INTERVAL_MS=30000
```

---

## Résumé des nouveaux fichiers à créer

### Central_Server (nouveau module `tenant-provisioning`)
```
backend/src/modules/tenant-provisioning/
├── tenant-provisioning.routes.js   # POST /api/tenants/register, GET /api/tenants/:id
├── tenant-provisioning.service.js  # Logique enregistrement + DNS + Heartbeat
├── dns.service.js                  # Intégration PowerDNS API
└── tunnel.gateway.js               # WebSocket mTLS pour les Tunnel Connectors
```

### Migrations Central_Server
```
backend/migrations/010_tenant_provisioning.sql
```

### Client Web
```
frontend/web/src/lib/networkDetector.js
frontend/web/src/components/NetworkModeIndicator.jsx
```

### Client Mobile (React Native)
```
frontend/mobile/src/lib/networkDetector.ts
frontend/mobile/src/lib/e2eStorage.ts
frontend/mobile/src/services/CallService.ts
frontend/mobile/src/services/PushService.ts
frontend/mobile/src/screens/VideoConferenceScreen/
frontend/mobile/src/components/videoconference/
```

### Script d'installation
```
tenant/install.sh                  # Script bash d'installation
tenant/docker-compose.tenant.yml   # Orchestration des services tenant
tenant/nginx/nginx.conf.template   # Template Nginx avec TLS
tenant/tunnel-connector/           # Agent de connexion au Central_Server
```
