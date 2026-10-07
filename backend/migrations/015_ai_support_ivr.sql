-- ============================================================
-- Migration 015 - Base de connaissance AI + Configuration IVR
-- Service client vocal avec agent IA et menu interactif
-- ============================================================

-- ── Base de connaissance principale (lue par l'agent AI via RAG) ─────────────
-- Nommée "connaissance_base" pour correspondre exactement à la config
-- KB_TABLE=connaissance_base dans ai/.env.example
CREATE TABLE IF NOT EXISTS connaissance_base (
  id          BIGSERIAL PRIMARY KEY,
  question    TEXT NOT NULL,
  response    TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'general'
                CHECK (type IN ('general', 'technique', 'videoconference', 'installation', 'developer', 'facturation', 'compte', 'autre')),
  ivr_option  SMALLINT,            -- option IVR à laquelle cette entrée se rattache (1-4, NULL = globale)
  active      BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_connaissance_base_type       ON connaissance_base(type);
CREATE INDEX idx_connaissance_base_ivr_option ON connaissance_base(ivr_option) WHERE ivr_option IS NOT NULL;
CREATE INDEX idx_connaissance_base_active     ON connaissance_base(active) WHERE active = true;

-- ── Configuration IVR (menu vocal interactif) ────────────────────────────────
-- Stocke les paramètres de chaque option du menu IVR principal et sous-menus
CREATE TABLE IF NOT EXISTS ivr_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version     INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT false,  -- une seule config active à la fois
  label       VARCHAR(100) NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_ivr_config_active ON ivr_config(is_active) WHERE is_active = true;

-- ── Paramètres de l'agent AI pour le service client ──────────────────────────
CREATE TABLE IF NOT EXISTS ai_support_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_url          TEXT,
  agent_name          VARCHAR(100) NOT NULL DEFAULT 'Assistant Palabre',
  welcome_message     TEXT NOT NULL DEFAULT 'Bonjour, je suis l''assistant de la plateforme Palabre. Comment puis-je vous aider ?',
  fallback_message    TEXT NOT NULL DEFAULT 'Je n''ai pas trouvé de réponse précise à votre question. Un conseiller va prendre en charge votre demande.',
  language            VARCHAR(10) NOT NULL DEFAULT 'fr',
  voice_enabled       BOOLEAN NOT NULL DEFAULT false,
  updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insérer la configuration par défaut
INSERT INTO ai_support_config (id, agent_name, welcome_message, fallback_message)
VALUES (
  gen_random_uuid(),
  'Assistant Palabre',
  'Bonjour. Je suis l''assistant de la plateforme Palabre. Pour les questions liées à des problèmes techniques ou des difficultés rencontrées sur la plateforme, tapez 1. Pour les questions liées à la vidéoconférence, tapez 2. Pour les questions liées à l''installation ou la demande d''une organisation, tapez 3. Pour l''option développeurs, tapez 4. Pour parler directement à un conseiller, tapez 8. Pour annuler, tapez 0.',
  'Je n''ai pas trouvé de réponse précise à votre question. Je vous transfère vers un conseiller qui prendra en charge votre demande.'
)
ON CONFLICT DO NOTHING;

-- ── Configuration IVR par défaut ──────────────────────────────────────────────
INSERT INTO ivr_config (label, is_active, config)
VALUES (
  'Configuration principale',
  true,
  '{
    "options": [
      {
        "key": "1",
        "label": "Problèmes techniques",
        "type": "technique",
        "description": "Questions liées à des problèmes techniques ou des difficultés rencontrées sur la plateforme",
        "prompt": "Vous avez sélectionné l''assistance technique. Décrivez votre problème et je vais vous aider."
      },
      {
        "key": "2",
        "label": "Vidéoconférence",
        "type": "videoconference",
        "description": "Questions liées à des difficultés rencontrées avec la vidéoconférence",
        "prompt": "Vous avez sélectionné l''assistance vidéoconférence. Décrivez votre difficulté."
      },
      {
        "key": "3",
        "label": "Installation et organisation",
        "type": "installation",
        "description": "Questions liées à l''installation ou la demande de création d''une organisation",
        "prompt": "Vous avez sélectionné l''assistance installation et organisation. Comment puis-je vous aider ?"
      },
      {
        "key": "4",
        "label": "Développeurs",
        "type": "developer",
        "description": "Option dédiée aux développeurs utilisant la plateforme",
        "prompt": "Vous avez sélectionné l''espace développeurs. Posez votre question technique."
      },
      {
        "key": "8",
        "label": "Conseiller humain",
        "type": "human_agent",
        "description": "Transfert vers un conseiller humain",
        "prompt": "Transfert en cours vers un conseiller. Veuillez patienter."
      },
      {
        "key": "0",
        "label": "Annuler",
        "type": "cancel",
        "description": "Annuler et raccrocher",
        "prompt": "Merci de votre appel. Au revoir."
      }
    ]
  }'::jsonb
)
ON CONFLICT DO NOTHING;

-- ── Entrées de connaissance initiales par catégorie ───────────────────────────
INSERT INTO connaissance_base (question, response, type, ivr_option) VALUES
  -- Option 1 : Technique générale
  ('Je ne peux pas me connecter à mon compte', 'Vérifiez que votre adresse email est correcte et que votre mot de passe est bien saisi. Si le problème persiste, utilisez la fonction de récupération de compte depuis la page de connexion. Vous pouvez également contacter le support via le formulaire en ligne.', 'technique', 1),
  ('L''application ne se charge pas', 'Commencez par vider le cache de votre navigateur ou de l''application. Vérifiez votre connexion internet. Si le problème persiste après un rechargement de la page, contactez le support technique avec une capture d''écran du message d''erreur.', 'technique', 1),
  ('Mon compte a été suspendu', 'La suspension de compte peut survenir suite à une violation des conditions d''utilisation ou à une demande de l''administrateur de votre organisation. Contactez le support en fournissant votre adresse email et les circonstances de la suspension.', 'technique', 1),
  ('Je ne reçois pas le code de vérification', 'Vérifiez votre dossier de courriers indésirables. Assurez-vous que le numéro de téléphone ou l''adresse email enregistrés sont corrects dans vos paramètres. Patientez quelques minutes avant de demander un nouveau code.', 'technique', 1),

  -- Option 2 : Vidéoconférence
  ('Je ne peux pas rejoindre une réunion vidéo', 'Vérifiez que votre navigateur autorise l''accès à la caméra et au microphone. Utilisez un navigateur compatible tel que Chrome ou Firefox en version récente. Vérifiez votre connexion internet et assurez-vous que le lien de réunion est correct et non expiré.', 'videoconference', 2),
  ('Ma caméra ne fonctionne pas pendant la réunion', 'Accédez aux paramètres de votre navigateur et vérifiez que la caméra est autorisée pour le site Palabre. Fermez les autres applications qui pourraient utiliser la caméra. Essayez de déconnecter et reconnecter votre caméra si elle est externe.', 'videoconference', 2),
  ('L''audio est de mauvaise qualité', 'Vérifiez que votre microphone est correctement sélectionné dans les paramètres de la réunion. Réduisez les sources de bruit environnant. Essayez de désactiver et réactiver votre microphone. Utilisez un casque pour améliorer la qualité audio.', 'videoconference', 2),
  ('Comment enregistrer une réunion', 'L''enregistrement des réunions est disponible selon le niveau d''abonnement de votre organisation. L''administrateur de votre organisation peut activer cette fonctionnalité depuis le tableau de bord. Contactez votre administrateur pour les droits d''enregistrement.', 'videoconference', 2),
  ('Je ne peux pas partager mon écran', 'Vérifiez que votre navigateur autorise le partage d''écran pour le site Palabre. Sur certains systèmes, une autorisation supplémentaire au niveau du système d''exploitation peut être nécessaire. Essayez de recharger la page et de relancer le partage.', 'videoconference', 2),

  -- Option 3 : Installation et organisation
  ('Comment créer une organisation sur Palabre', 'Pour créer une organisation, accédez à la section Onboarding depuis votre tableau de bord. Remplissez le formulaire avec les informations de votre organisation incluant le nom, le secteur d''activité et les informations administratives. Votre demande sera examinée dans un délai de 24 à 48 heures ouvrables.', 'installation', 3),
  ('Comment inviter des membres dans mon organisation', 'Depuis le tableau de bord de votre organisation, accédez à la section Membres et cliquez sur Inviter. Saisissez les adresses email des personnes à inviter et choisissez leur rôle. Ils recevront un email d''invitation avec un lien pour rejoindre votre organisation.', 'installation', 3),
  ('Comment installer l''application mobile', 'L''application Palabre est disponible pour Android via le Google Play Store et pour iOS via l''App Store. Recherchez Palabre dans la boutique correspondant à votre appareil et procédez à l''installation. Connectez-vous avec vos identifiants existants.', 'installation', 3),
  ('Statut en attente de mon organisation', 'Votre organisation est en cours de vérification par l''équipe Palabre. Ce processus prend généralement entre 24 et 48 heures ouvrables. Vous recevrez une notification par email lorsque votre organisation sera activée. Vérifiez votre dossier courriers indésirables.', 'installation', 3),

  -- Option 4 : Développeurs
  ('Comment obtenir des clés API', 'Accédez au portail développeur depuis votre tableau de bord. Créez un projet en fournissant son nom et sa description. Les clés API publique et secrète seront générées automatiquement. Conservez la clé secrète en lieu sûr, elle ne sera plus affichée après la création.', 'developer', 4),
  ('Documentation de l''API Palabre', 'La documentation complète de l''API est disponible à l''adresse /docs depuis votre instance Palabre. Elle inclut la référence de tous les endpoints, les modèles de données, les exemples de requêtes et les guides d''intégration pour les principaux cas d''usage.', 'developer', 4),
  ('Limites de l''API et quotas', 'Les limites de l''API dépendent du niveau d''abonnement de votre organisation. Consultez votre tableau de bord développeur pour voir vos quotas actuels et votre consommation. En cas de dépassement, contactez le support pour discuter d''une augmentation de vos limites.', 'developer', 4),
  ('Comment gérer les webhooks', 'Les webhooks permettent à votre application de recevoir des notifications en temps réel lors d''événements sur la plateforme. Configurez vos URLs de webhook depuis le portail développeur. Assurez-vous que votre endpoint peut répondre dans un délai de 10 secondes.', 'developer', 4),

  -- Questions générales (toutes options)
  ('Quels sont les plans tarifaires disponibles', 'Palabre propose quatre plans : Starter pour les petites équipes, Pro pour les équipes en croissance, Business pour les organisations établies et Enterprise pour les grandes structures avec des besoins avancés. Contactez notre équipe commerciale pour un devis personnalisé.', 'facturation', NULL),
  ('Comment contacter le support', 'Vous pouvez contacter le support Palabre via le chat intégré à la plateforme, par email à l''adresse de support, ou en appelant notre service client depuis cette interface. Le support est disponible du lundi au vendredi de 8h à 18h, heure locale.', 'general', NULL),
  ('Comment réinitialiser mon mot de passe', 'Depuis la page de connexion, cliquez sur Mot de passe oublié. Saisissez votre adresse email. Vous recevrez un lien de réinitialisation valable 15 minutes. Suivez le lien et créez un nouveau mot de passe sécurisé d''au moins 8 caractères.', 'compte', NULL),
  ('Comment activer la double authentification', 'Accédez aux paramètres de sécurité de votre compte. Activez la vérification en deux étapes. Vous pouvez utiliser votre empreinte digitale, une clé de sécurité physique ou un code envoyé par SMS. Il est fortement recommandé d''activer cette fonctionnalité.', 'compte', NULL)
ON CONFLICT DO NOTHING;
