CREATE TABLE developer_accounts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un seul compte développeur par utilisateur Palabre
  CONSTRAINT uq_developer_accounts_user UNIQUE (user_id)
);

CREATE INDEX idx_developer_accounts_user ON developer_accounts(user_id);

COMMENT ON TABLE  developer_accounts              IS 'Compte développeur, lié 1:1 à un utilisateur Palabre. Créé au premier accès.';
COMMENT ON COLUMN developer_accounts.id           IS 'Identifiant unique du compte développeur (UUID v4).';
COMMENT ON COLUMN developer_accounts.user_id      IS 'Référence vers l'utilisateur Palabre propriétaire du compte.';
COMMENT ON COLUMN developer_accounts.status       IS 'État du compte : active (opérationnel) ou suspended (bloqué par l'équipe Palabre).';
COMMENT ON COLUMN developer_accounts.created_at   IS 'Date de création du compte développeur.';
COMMENT ON COLUMN developer_accounts.updated_at   IS 'Date de dernière mise à jour (statut, etc.).';



CREATE TABLE developer_projects (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID        NOT NULL REFERENCES developer_accounts(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  description      TEXT,
  logo_url         TEXT,
  color_primary    TEXT        CHECK (color_primary ~ '^#[0-9A-Fa-f]{6}$'),
  color_secondary  TEXT        CHECK (color_secondary ~ '^#[0-9A-Fa-f]{6}$'),
  display_name     TEXT,
  webhook_url      TEXT        CHECK (webhook_url IS NULL OR webhook_url LIKE 'https://%'),
  status           TEXT        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'inactive', 'deleted')),
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_developer_projects_account    ON developer_projects(account_id);
CREATE INDEX idx_developer_projects_status     ON developer_projects(status);
CREATE INDEX idx_developer_projects_deleted_at ON developer_projects(deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON TABLE  developer_projects                 IS 'Projet développeur : unité d''intégration (1 projet = 1 paire de clés API + config white-label).';
COMMENT ON COLUMN developer_projects.id              IS 'Identifiant unique du projet (UUID v4).';
COMMENT ON COLUMN developer_projects.account_id      IS 'Compte développeur propriétaire du projet.';
COMMENT ON COLUMN developer_projects.name            IS 'Nom technique du projet (2–100 caractères).';
COMMENT ON COLUMN developer_projects.description     IS 'Description optionnelle du projet.';
COMMENT ON COLUMN developer_projects.logo_url        IS 'URL du logo utilisé pour le white-labeling.';
COMMENT ON COLUMN developer_projects.color_primary   IS 'Couleur principale en hexadécimal (#RRGGBB) pour le white-labeling.';
COMMENT ON COLUMN developer_projects.color_secondary IS 'Couleur secondaire en hexadécimal (#RRGGBB) pour le white-labeling.';
COMMENT ON COLUMN developer_projects.display_name    IS 'Nom affiché à l''utilisateur final (white-label). Remplace "Palabre" dans les SDK.';
COMMENT ON COLUMN developer_projects.webhook_url     IS 'URL HTTPS de webhook globale du projet (dépréciée en faveur de developer_webhooks).';
COMMENT ON COLUMN developer_projects.status          IS 'État du projet : active, inactive (suspendu par le développeur) ou deleted (soft-delete).';
COMMENT ON COLUMN developer_projects.deleted_at      IS 'Horodatage du soft-delete. NULL si le projet est actif. Données purgées après 90 jours.';
COMMENT ON COLUMN developer_projects.created_at      IS 'Date de création du projet.';
COMMENT ON COLUMN developer_projects.updated_at      IS 'Date de dernière modification.';




CREATE TABLE developer_api_keys (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES developer_projects(id) ON DELETE CASCADE,
  key_type        TEXT        NOT NULL CHECK (key_type IN ('publishable', 'secret')),
  key_prefix      TEXT        NOT NULL,
  key_value       TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'revoked')),
  revoked_at      TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un seul exemplaire actif par type et par projet
  CONSTRAINT uq_active_key_per_type UNIQUE (project_id, key_type, status)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_developer_api_keys_project ON developer_api_keys(project_id, status);
CREATE INDEX idx_developer_api_keys_value   ON developer_api_keys(key_value) WHERE status = 'active';

COMMENT ON TABLE  developer_api_keys               IS 'Clés API d''un projet développeur. Chaque projet possède une clé publishable et une clé secrète.';
COMMENT ON COLUMN developer_api_keys.id            IS 'Identifiant unique de la clé (UUID v4).';
COMMENT ON COLUMN developer_api_keys.project_id    IS 'Projet auquel appartient cette clé.';
COMMENT ON COLUMN developer_api_keys.key_type      IS 'Type de clé : publishable (côté client) ou secret (côté serveur).';
COMMENT ON COLUMN developer_api_keys.key_prefix    IS 'Préfixe lisible de la clé (pk_live_ ou sk_live_) facilitant l''identification visuelle.';
COMMENT ON COLUMN developer_api_keys.key_value     IS 'Valeur brute pour les clés publishable ; hash SHA-256 pour les clés secret.';
COMMENT ON COLUMN developer_api_keys.status        IS 'État de la clé : active (utilisable) ou revoked (révoquée, grace period de 60s via Redis).';
COMMENT ON COLUMN developer_api_keys.revoked_at    IS 'Horodatage de révocation. NULL si la clé est encore active.';
COMMENT ON COLUMN developer_api_keys.last_used_at  IS 'Dernière utilisation de la clé (mise à jour de manière asynchrone).';
COMMENT ON COLUMN developer_api_keys.created_at    IS 'Date de création ou de rotation de la clé.';



CREATE TABLE developer_webhooks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES developer_projects(id) ON DELETE CASCADE,
  url           TEXT        NOT NULL CHECK (url LIKE 'https://%'),
  events        TEXT[]      NOT NULL DEFAULT '{}',
  secret        TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'failed', 'disabled')),
  failure_count INTEGER     NOT NULL DEFAULT 0,
  last_fired_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_developer_webhooks_project ON developer_webhooks(project_id, status);

COMMENT ON TABLE  developer_webhooks               IS 'Endpoints de webhooks configurés par un projet pour recevoir les événements Palabre en temps réel.';
COMMENT ON COLUMN developer_webhooks.id            IS 'Identifiant unique du webhook (UUID v4).';
COMMENT ON COLUMN developer_webhooks.project_id    IS 'Projet propriétaire de ce webhook.';
COMMENT ON COLUMN developer_webhooks.url           IS 'URL HTTPS de destination (obligatoirement HTTPS pour la sécurité des données).';
COMMENT ON COLUMN developer_webhooks.events        IS 'Liste des types d''événements souscrits, ex. {message.received,call.ended}.';
COMMENT ON COLUMN developer_webhooks.secret        IS 'Secret HMAC-SHA256 dédié à ce webhook (distinct de la clé secrète du projet).';
COMMENT ON COLUMN developer_webhooks.status        IS 'État : active (opérationnel), failed (3 échecs consécutifs) ou disabled (désactivé manuellement).';
COMMENT ON COLUMN developer_webhooks.failure_count IS 'Nombre d''échecs consécutifs. Remis à 0 après une livraison réussie.';
COMMENT ON COLUMN developer_webhooks.last_fired_at IS 'Horodatage du dernier envoi réussi.';
COMMENT ON COLUMN developer_webhooks.created_at    IS 'Date de création du webhook.';
COMMENT ON COLUMN developer_webhooks.updated_at    IS 'Date de dernière modification (url, events, statut).';



CREATE TABLE developer_webhook_deliveries (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id    UUID        NOT NULL REFERENCES developer_webhooks(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL,
  payload       JSONB       NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'delivered', 'failed')),
  response_code INTEGER,
  response_body TEXT,
  attempts      INTEGER     NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_webhook    ON developer_webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_status     ON developer_webhook_deliveries(status)
  WHERE status IN ('pending', 'failed');
CREATE INDEX idx_webhook_deliveries_next_retry ON developer_webhook_deliveries(next_retry_at)
  WHERE status = 'pending' AND next_retry_at IS NOT NULL;

COMMENT ON TABLE  developer_webhook_deliveries                IS 'Historique de chaque tentative d''envoi d''un événement vers un endpoint webhook.';
COMMENT ON COLUMN developer_webhook_deliveries.id             IS 'Identifiant unique de la tentative de livraison (UUID v4).';
COMMENT ON COLUMN developer_webhook_deliveries.webhook_id     IS 'Webhook cible de cet envoi.';
COMMENT ON COLUMN developer_webhook_deliveries.event_type     IS 'Type d''événement déclenché (ex. message.received, call.ended).';
COMMENT ON COLUMN developer_webhook_deliveries.payload        IS 'Corps JSON de l''événement envoyé au endpoint.';
COMMENT ON COLUMN developer_webhook_deliveries.status         IS 'État de la livraison : pending (en attente/retry), delivered (succès), failed (échec définitif).';
COMMENT ON COLUMN developer_webhook_deliveries.response_code  IS 'Code HTTP retourné par le endpoint du développeur (NULL si erreur réseau).';
COMMENT ON COLUMN developer_webhook_deliveries.response_body  IS 'Corps de la réponse HTTP (tronqué à 1000 caractères).';
COMMENT ON COLUMN developer_webhook_deliveries.attempts       IS 'Nombre de tentatives d''envoi effectuées (max 3 avec backoff exponentiel).';
COMMENT ON COLUMN developer_webhook_deliveries.next_retry_at  IS 'Horodatage de la prochaine tentative planifiée (NULL si livré ou échoué définitivement).';
COMMENT ON COLUMN developer_webhook_deliveries.delivered_at   IS 'Horodatage de la livraison réussie. NULL tant que non livré.';
COMMENT ON COLUMN developer_webhook_deliveries.created_at     IS 'Date de création de la tentative initiale.';



CREATE TABLE developer_sdk_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES developer_projects(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sdk_events_project_date ON developer_sdk_events(project_id, created_at DESC);
CREATE INDEX idx_sdk_events_event_type   ON developer_sdk_events(project_id, event_type, created_at DESC);

COMMENT ON TABLE  developer_sdk_events             IS 'Événements SDK : trace de chaque appel API par projet pour les statistiques d''usage. Purgés après 90 jours.';
COMMENT ON COLUMN developer_sdk_events.id          IS 'Identifiant unique de l''événement (UUID v4).';
COMMENT ON COLUMN developer_sdk_events.project_id  IS 'Projet à l''origine de l''appel API.';
COMMENT ON COLUMN developer_sdk_events.event_type  IS 'Type d''appel : message_sent, call_made, api_call, active_user, video_room_created, push_sent, etc.';
COMMENT ON COLUMN developer_sdk_events.payload     IS 'Métadonnées optionnelles de l''appel (user_id tiers, endpoint, durée, etc.). Peut être NULL.';
COMMENT ON COLUMN developer_sdk_events.created_at  IS 'Date de l''appel API. Utilisée pour les agrégations quotidiennes et la purge à 90 jours.';
