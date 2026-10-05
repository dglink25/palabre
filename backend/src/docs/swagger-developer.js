/**
 * Documentation OpenAPI 3.0 - Palabre for Developers
 * Routes : /api/v1/developer/*
 *
 * Requirements: 9.1, 9.2
 */

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Palabre Developer API',
    version: '1.0.0',
    description:
      "API REST du portail développeur Palabre (CPaaS). Permet aux développeurs externes de créer des projets d'intégration, de gérer leurs clés API, d'accéder aux fonctionnalités de communication (messagerie, appels, vidéoconférence, push) et de configurer des webhooks.",
    contact: {
      name: 'Palabre Developer Support',
      url: 'https://developer.palabre.app',
    },
  },
  servers: [
    {
      url: '/api/v1/developer',
      description: 'API Gateway - module Developer',
    },
  ],

  // -------------------------------------------------------------------------
  // Schémas de sécurité
  // -------------------------------------------------------------------------
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT émis par le SSO Palabre. À transmettre dans l\'en-tête `Authorization: Bearer <token>`. Requis pour toutes les routes de gestion (comptes, projets, clés, webhooks, statistiques).',
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Palabre-Key',
        description:
          "Publishable Key du projet (préfixe `pk_live_`). Utilisée côté client (navigateur, application mobile) pour les routes proxy (messages, appels, vidéo, push) et la récupération de la White_Label_Config.",
      },
      SecretKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Palabre-Secret',
        description:
          "Secret Key du projet (préfixe `sk_live_`). À utiliser exclusivement côté serveur. La valeur brute est transmise dans l'en-tête ; elle est hashée SHA-256 avant comparaison en base.",
      },
    },

    // -----------------------------------------------------------------------
    // Schémas de données réutilisables
    // -----------------------------------------------------------------------
    schemas: {
      // --- Erreur générique ---
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'INVALID_API_KEY',
              },
              message: {
                type: 'string',
                example: 'Clé API invalide ou révoquée.',
              },
            },
            required: ['code', 'message'],
          },
        },
      },

      // --- DeveloperAccount ---
      DeveloperAccount: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: 'c3d4e5f6-0000-0000-0000-000000000001',
          },
          user_id: {
            type: 'string',
            format: 'uuid',
            example: 'a1b2c3d4-0000-0000-0000-000000000001',
          },
          status: {
            type: 'string',
            enum: ['active', 'suspended'],
            example: 'active',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z',
          },
          user: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                example: 'Alice Dupont',
              },
              avatar_url: {
                type: 'string',
                format: 'uri',
                example: 'https://palabre.app/avatars/alice.jpg',
              },
            },
          },
        },
      },

      // --- DeveloperProject (liste) ---
      DeveloperProjectSummary: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: 'd1e2f3a4-0000-0000-0000-000000000002',
          },
          name: {
            type: 'string',
            example: 'Mon Application Mobile',
          },
          description: {
            type: 'string',
            nullable: true,
            example: 'Application de chat pour équipes distribuées',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive'],
            example: 'active',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-02-01T09:00:00.000Z',
          },
        },
      },

      // --- DeveloperProject (détail complet) ---
      DeveloperProjectDetail: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
            example: 'Mon Application Mobile',
          },
          description: {
            type: 'string',
            nullable: true,
          },
          logo_url: {
            type: 'string',
            format: 'uri',
            nullable: true,
            example: 'https://cdn.monapp.com/logo.png',
          },
          color_primary: {
            type: 'string',
            pattern: '^#[0-9A-Fa-f]{6}$',
            nullable: true,
            example: '#3B82F6',
          },
          color_secondary: {
            type: 'string',
            pattern: '^#[0-9A-Fa-f]{6}$',
            nullable: true,
            example: '#1D4ED8',
          },
          display_name: {
            type: 'string',
            nullable: true,
            example: 'MonApp Chat',
          },
          webhook_url: {
            type: 'string',
            format: 'uri',
            nullable: true,
            example: 'https://api.monapp.com/webhooks/palabre',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive'],
            example: 'active',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
          },
          publishable_key: {
            type: 'string',
            example: 'pk_live_a1b2c3d4e5f6...',
          },
          secret_key_masked: {
            type: 'string',
            description: 'Secret key masquée - seuls les 4 derniers caractères sont visibles.',
            example: 'sk_live_••••••••••••abcd',
          },
        },
      },

      // --- ApiKey ---
      ApiKey: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          key_type: {
            type: 'string',
            enum: ['publishable', 'secret'],
          },
          key_value: {
            type: 'string',
            description:
              'Valeur brute pour la publishable key ; masquée (`sk_live_••••••••••••xxxx`) pour la secret key.',
            example: 'pk_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          },
          status: {
            type: 'string',
            enum: ['active', 'revoked'],
          },
          created_at: {
            type: 'string',
            format: 'date-time',
          },
          last_used_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
        },
      },

      // --- WhiteLabelConfig ---
      WhiteLabelConfig: {
        type: 'object',
        properties: {
          white_label_config: {
            type: 'object',
            properties: {
              logo_url: {
                type: 'string',
                format: 'uri',
                nullable: true,
                example: 'https://cdn.monapp.com/logo.png',
              },
              color_primary: {
                type: 'string',
                nullable: true,
                example: '#3B82F6',
              },
              color_secondary: {
                type: 'string',
                nullable: true,
                example: '#1D4ED8',
              },
              display_name: {
                type: 'string',
                nullable: true,
                example: 'MonApp Chat',
              },
            },
          },
        },
      },

      // --- Webhook ---
      Webhook: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          project_id: {
            type: 'string',
            format: 'uuid',
          },
          url: {
            type: 'string',
            format: 'uri',
            example: 'https://api.monapp.com/webhooks/palabre',
          },
          events: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'message.received',
                'call.missed',
                'call.started',
                'call.ended',
                'user.online',
                'user.offline',
                'notification.sent',
              ],
            },
            example: ['message.received', 'call.ended'],
          },
          status: {
            type: 'string',
            enum: ['active', 'failed', 'disabled'],
          },
          failure_count: {
            type: 'integer',
            example: 0,
          },
          last_fired_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          created_at: {
            type: 'string',
            format: 'date-time',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
          },
        },
      },

      // --- WebhookDelivery ---
      WebhookDelivery: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          webhook_id: {
            type: 'string',
            format: 'uuid',
          },
          event_type: {
            type: 'string',
            example: 'message.received',
          },
          status: {
            type: 'string',
            enum: ['pending', 'delivered', 'failed'],
          },
          response_code: {
            type: 'integer',
            nullable: true,
            example: 200,
          },
          response_body: {
            type: 'string',
            nullable: true,
            example: '{"ok":true}',
          },
          attempts: {
            type: 'integer',
            example: 1,
          },
          created_at: {
            type: 'string',
            format: 'date-time',
          },
          delivered_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
        },
      },

      // --- ProjectStats ---
      ProjectStats: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', '7d', '30d', '90d'],
            example: '30d',
          },
          messages_sent: {
            type: 'integer',
            example: 1420,
          },
          calls_made: {
            type: 'integer',
            example: 87,
          },
          active_users: {
            type: 'integer',
            example: 234,
          },
          api_calls: {
            type: 'integer',
            example: 5678,
          },
        },
      },
    },

    // -----------------------------------------------------------------------
    // Réponses réutilisables
    // -----------------------------------------------------------------------
    responses: {
      Unauthorized: {
        description: 'Authentification manquante ou invalide.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'INVALID_API_KEY',
                message: 'Clé API invalide ou révoquée.',
              },
            },
          },
        },
      },
      Forbidden: {
        description: "Accès interdit - le projet n'appartient pas au compte connecté.",
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'FORBIDDEN',
                message: "Accès non autorisé à ce projet.",
              },
            },
          },
        },
      },
      NotFound: {
        description: 'Ressource introuvable.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'PROJECT_NOT_FOUND',
                message: 'Projet introuvable.',
              },
            },
          },
        },
      },
      UnprocessableEntity: {
        description: 'Données de requête invalides.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Le nom du projet doit contenir entre 2 et 100 caractères.',
              },
            },
          },
        },
      },
      TooManyRequests: {
        description: 'Limite de débit dépassée - 1 000 req/min par projet.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'RATE_LIMIT_EXCEEDED' },
                    message: { type: 'string', example: 'Limite de 1000 requêtes/minute dépassée.' },
                  },
                },
                retryAfter: {
                  type: 'integer',
                  description: 'Nombre de secondes avant de pouvoir réessayer.',
                  example: 42,
                },
              },
            },
          },
        },
      },
      InternalError: {
        description: 'Erreur interne du serveur.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Erreur interne du serveur.',
              },
            },
          },
        },
      },
    },
  },

  // =========================================================================
  // PATHS
  // =========================================================================
  paths: {
    // -------------------------------------------------------------------------
    // ACCOUNTS
    // -------------------------------------------------------------------------
    '/accounts/me': {
      post: {
        tags: ['Compte développeur'],
        summary: "Crée ou retourne le compte développeur (upsert)",
        description:
          "Si aucun `developer_account` n'existe pour l'utilisateur connecté, en crée un et retourne HTTP 201. Sinon retourne le compte existant avec HTTP 200. Opération idempotente.",
        operationId: 'upsertDeveloperAccount',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Compte développeur existant retourné.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeveloperAccount' },
                example: {
                  id: 'c3d4e5f6-0000-0000-0000-000000000001',
                  user_id: 'a1b2c3d4-0000-0000-0000-000000000001',
                  status: 'active',
                  created_at: '2024-01-15T10:30:00.000Z',
                  updated_at: '2024-01-15T10:30:00.000Z',
                  user: { name: 'Alice Dupont', avatar_url: 'https://palabre.app/avatars/alice.jpg' },
                },
              },
            },
          },
          '201': {
            description: 'Compte développeur nouvellement créé.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeveloperAccount' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
      get: {
        tags: ['Compte développeur'],
        summary: 'Retourne le compte développeur de l\'utilisateur courant',
        operationId: 'getDeveloperAccount',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Compte développeur trouvé.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeveloperAccount' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // PROJECTS - Collection
    // -------------------------------------------------------------------------
    '/projects': {
      get: {
        tags: ['Projets'],
        summary: 'Liste tous les projets du compte développeur',
        description: "Retourne tous les projets actifs ou inactifs (excluant les projets soft-deleted). Triés par date de création décroissante.",
        operationId: 'listProjects',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Liste des projets.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    projects: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/DeveloperProjectSummary' },
                    },
                    total: {
                      type: 'integer',
                      example: 3,
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
      post: {
        tags: ['Projets'],
        summary: 'Crée un nouveau projet',
        description:
          "Crée un nouveau `developer_project` et génère automatiquement une Publishable_Key (`pk_live_...`) et une Secret_Key (`sk_live_...`). La Secret_Key est retournée en clair **une seule fois** dans cette réponse.",
        operationId: 'createProject',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: {
                    type: 'string',
                    minLength: 2,
                    maxLength: 100,
                    description: 'Nom du projet (obligatoire, 2–100 caractères).',
                    example: 'Mon Application Mobile',
                  },
                  description: {
                    type: 'string',
                    description: 'Description optionnelle.',
                    example: 'Application de chat pour équipes distribuées',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Projet créé avec succès.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/DeveloperProjectDetail' },
                    {
                      type: 'object',
                      properties: {
                        secret_key_plain: {
                          type: 'string',
                          description:
                            '**Valeur brute de la Secret_Key - visible une seule fois.** Conservez-la immédiatement.',
                          example: 'YOUR_SECRET_KEY_DISPLAYED_ONCE',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // PROJECTS - Item
    // -------------------------------------------------------------------------
    '/projects/{id}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'UUID du projet.',
          example: 'd1e2f3a4-0000-0000-0000-000000000002',
        },
      ],
      get: {
        tags: ['Projets'],
        summary: 'Détails d\'un projet',
        description:
          'Retourne le projet avec ses clés (secret masquée), sa configuration white-label et ses webhooks. Seul le propriétaire du projet peut y accéder.',
        operationId: 'getProject',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Détails du projet.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeveloperProjectDetail' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
      patch: {
        tags: ['Projets'],
        summary: 'Met à jour les métadonnées du projet',
        description: 'Met à jour les champs autorisés : name, description, logo_url, color_primary, color_secondary, display_name, webhook_url.',
        operationId: 'updateProject',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    minLength: 2,
                    maxLength: 100,
                    example: 'Mon App Renommée',
                  },
                  description: {
                    type: 'string',
                    nullable: true,
                    example: 'Nouvelle description',
                  },
                  logo_url: {
                    type: 'string',
                    format: 'uri',
                    nullable: true,
                    example: 'https://cdn.monapp.com/new-logo.png',
                  },
                  color_primary: {
                    type: 'string',
                    pattern: '^#[0-9A-Fa-f]{6}$',
                    nullable: true,
                    example: '#10B981',
                  },
                  color_secondary: {
                    type: 'string',
                    pattern: '^#[0-9A-Fa-f]{6}$',
                    nullable: true,
                    example: '#065F46',
                  },
                  display_name: {
                    type: 'string',
                    nullable: true,
                    example: 'MonApp 2.0',
                  },
                  webhook_url: {
                    type: 'string',
                    format: 'uri',
                    nullable: true,
                    example: 'https://api.monapp.com/webhooks/v2',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Projet mis à jour.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeveloperProjectDetail' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
      delete: {
        tags: ['Projets'],
        summary: 'Supprime (soft-delete) un projet',
        description:
          'Effectue un soft-delete du projet (status = "deleted", deleted_at = now()) et révoque toutes les clés API actives. Les données statistiques sont conservées 90 jours.',
        operationId: 'deleteProject',
        security: [{ BearerAuth: [] }],
        responses: {
          '204': {
            description: 'Projet supprimé.',
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // API KEYS
    // -------------------------------------------------------------------------
    '/projects/{id}/keys': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'UUID du projet.',
        },
      ],
      get: {
        tags: ['Clés API'],
        summary: 'Liste les clés actives du projet',
        description:
          'Retourne les clés actives du projet. La Publishable_Key est affichée en clair. La Secret_Key est masquée (`sk_live_••••••••••••xxxx`, 4 derniers caractères visibles).',
        operationId: 'listApiKeys',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Clés actives du projet.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    keys: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ApiKey' },
                    },
                  },
                },
                example: {
                  keys: [
                    {
                      id: 'key-uuid-pub',
                      key_type: 'publishable',
                      key_value: 'pk_live_a1b2c3d4e5f6...',
                      status: 'active',
                      created_at: '2024-02-01T09:00:00.000Z',
                      last_used_at: '2024-03-10T14:22:00.000Z',
                    },
                    {
                      id: 'key-uuid-sec',
                      key_type: 'secret',
                      key_value: 'sk_live_••••••••••••abcd',
                      status: 'active',
                      created_at: '2024-02-01T09:00:00.000Z',
                      last_used_at: null,
                    },
                  ],
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/projects/{id}/keys/rotate': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'UUID du projet.',
        },
      ],
      post: {
        tags: ['Clés API'],
        summary: 'Rotation d\'une clé API',
        description:
          "Révoque l'ancienne clé et génère une nouvelle clé du type spécifié. L'ancienne clé reste valide pendant une **grace period de 60 secondes** via Redis. La nouvelle valeur brute est retournée **une seule fois**. Nécessite `confirm: true` dans le body.",
        operationId: 'rotateApiKey',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['key_type', 'confirm'],
                properties: {
                  key_type: {
                    type: 'string',
                    enum: ['publishable', 'secret'],
                    description: 'Type de la clé à faire tourner.',
                    example: 'secret',
                  },
                  confirm: {
                    type: 'boolean',
                    enum: [true],
                    description: 'Doit être `true` pour confirmer la rotation (protection anti-accident).',
                    example: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Rotation effectuée. Nouvelle clé retournée en clair (once-only).',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    key_type: {
                      type: 'string',
                      enum: ['publishable', 'secret'],
                    },
                    new_key: {
                      type: 'string',
                      description: 'Valeur brute de la nouvelle clé - visible une seule fois.',
                      example: 'YOUR_NEW_SECRET_KEY_DISPLAYED_ONCE',
                    },
                    grace_period_seconds: {
                      type: 'integer',
                      description: "Durée pendant laquelle l'ancienne clé reste valide.",
                      example: 60,
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // WHITE-LABEL CONFIG (auth par X-Palabre-Key)
    // -------------------------------------------------------------------------
    '/projects/{id}/config': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'UUID du projet.',
        },
      ],
      get: {
        tags: ['White-Label'],
        summary: 'Récupère la White_Label_Config du projet',
        description:
          "Endpoint public authentifié par `X-Palabre-Key`. Utilisé par les SDKs pour récupérer la configuration de marque (logo, couleurs, nom d'affichage). La clé fournie doit correspondre au projet demandé.",
        operationId: 'getProjectConfig',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description: 'Configuration white-label du projet.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WhiteLabelConfig' },
                example: {
                  white_label_config: {
                    logo_url: 'https://cdn.monapp.com/logo.png',
                    color_primary: '#3B82F6',
                    color_secondary: '#1D4ED8',
                    display_name: 'MonApp Chat',
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // PROXY - Messages
    // -------------------------------------------------------------------------
    '/proxy/messages': {
      post: {
        tags: ['Proxy - Fonctionnalités'],
        summary: 'Envoie un message via l\'infrastructure Palabre',
        description:
          "Transmet un message au destinataire via l'infrastructure de messagerie E2E Palabre. Le message est isolé au projet identifié par la clé API.",
        operationId: 'proxySendMessage',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['recipient_id', 'content'],
                properties: {
                  recipient_id: {
                    type: 'string',
                    description: 'Identifiant de l\'utilisateur destinataire.',
                    example: 'user-uuid-recipient',
                  },
                  content: {
                    type: 'string',
                    description: 'Contenu textuel du message.',
                    example: 'Bonjour, comment puis-je vous aider ?',
                  },
                  metadata: {
                    type: 'object',
                    description: 'Métadonnées optionnelles transmises au destinataire.',
                    additionalProperties: true,
                    example: { conversation_id: 'conv-001', priority: 'high' },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Message envoyé avec succès.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message_id: {
                      type: 'string',
                      example: 'msg-uuid-001',
                    },
                    status: {
                      type: 'string',
                      example: 'sent',
                    },
                    sent_at: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // PROXY - Calls
    // -------------------------------------------------------------------------
    '/proxy/calls': {
      post: {
        tags: ['Proxy - Fonctionnalités'],
        summary: 'Initie un appel WebRTC',
        description:
          "Lance un appel audio/vidéo WebRTC via l'infrastructure Palabre. Retourne les credentials TURN et les informations de signalisation nécessaires pour établir la connexion pair-à-pair.",
        operationId: 'proxyInitiateCall',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['callee_id'],
                properties: {
                  callee_id: {
                    type: 'string',
                    description: 'Identifiant de l\'utilisateur à appeler.',
                    example: 'user-uuid-callee',
                  },
                  call_type: {
                    type: 'string',
                    enum: ['audio', 'video'],
                    default: 'audio',
                    example: 'video',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Appel initié - credentials TURN retournés.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    call_id: {
                      type: 'string',
                      example: 'call-uuid-001',
                    },
                    turn_credentials: {
                      type: 'object',
                      properties: {
                        urls: {
                          type: 'array',
                          items: { type: 'string' },
                          example: ['turn:turn.palabre.app:3478'],
                        },
                        username: { type: 'string', example: '1710000000:user-uuid' },
                        credential: { type: 'string', example: 'hmac-credential-value' },
                      },
                    },
                    signaling_token: {
                      type: 'string',
                      example: 'signal-jwt-token',
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // PROXY - Video rooms
    // -------------------------------------------------------------------------
    '/proxy/video/rooms': {
      post: {
        tags: ['Proxy - Fonctionnalités'],
        summary: 'Crée une room de vidéoconférence',
        description:
          "Crée une room Jitsi via l'infrastructure Palabre et retourne le token de session permettant à l'utilisateur de rejoindre la conférence.",
        operationId: 'proxyCreateVideoRoom',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  room_name: {
                    type: 'string',
                    description: 'Nom optionnel de la room. Généré automatiquement si absent.',
                    example: 'equipe-produit-standup',
                  },
                  max_participants: {
                    type: 'integer',
                    minimum: 2,
                    maximum: 100,
                    default: 10,
                    example: 20,
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Room créée - token de session retourné.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    room_id: {
                      type: 'string',
                      example: 'palabre-room-abc123',
                    },
                    room_url: {
                      type: 'string',
                      format: 'uri',
                      example: 'https://meet.palabre.app/palabre-room-abc123',
                    },
                    session_token: {
                      type: 'string',
                      description: 'JWT permettant de rejoindre la room Jitsi.',
                      example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
                    },
                    expires_at: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // PROXY - Push notifications
    // -------------------------------------------------------------------------
    '/proxy/push': {
      post: {
        tags: ['Proxy - Fonctionnalités'],
        summary: 'Envoie une notification push',
        description:
          "Envoie une notification push via Firebase Cloud Messaging (FCM) à un ou plusieurs utilisateurs finaux identifiés par leur token FCM.",
        operationId: 'proxyPushNotification',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fcm_token', 'notification'],
                properties: {
                  fcm_token: {
                    type: 'string',
                    description: 'Token FCM du destinataire.',
                    example: 'dGhpcyBpcyBhIHRlc3QgRkNNIHRva2Vu...',
                  },
                  notification: {
                    type: 'object',
                    required: ['title'],
                    properties: {
                      title: {
                        type: 'string',
                        example: 'Nouveau message',
                      },
                      body: {
                        type: 'string',
                        example: 'Vous avez reçu un nouveau message.',
                      },
                    },
                  },
                  data: {
                    type: 'object',
                    description: 'Données personnalisées transmises à l\'application mobile.',
                    additionalProperties: { type: 'string' },
                    example: { conversation_id: 'conv-001', sender_id: 'user-uuid' },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Notification push envoyée.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    fcm_message_id: {
                      type: 'string',
                      example: 'projects/palabre/messages/0:1710000000000000',
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // WEBHOOKS - Collection
    // -------------------------------------------------------------------------
    '/projects/{id}/webhooks': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'UUID du projet.',
        },
      ],
      get: {
        tags: ['Webhooks'],
        summary: 'Liste les webhooks du projet',
        description: 'Retourne tous les webhooks configurés pour le projet, avec leur url, events abonnés, statut et date de dernier envoi.',
        operationId: 'listWebhooks',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Liste des webhooks.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    webhooks: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Webhook' },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Crée un webhook',
        description:
          "Crée un nouveau webhook pour le projet. L'URL doit être en HTTPS. Le tableau `events` doit contenir au moins un type d'événement. Un secret HMAC est généré automatiquement pour la signature des requêtes.",
        operationId: 'createWebhook',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url', 'events'],
                properties: {
                  url: {
                    type: 'string',
                    format: 'uri',
                    description: 'URL HTTPS du webhook endpoint.',
                    example: 'https://api.monapp.com/webhooks/palabre',
                  },
                  events: {
                    type: 'array',
                    minItems: 1,
                    items: {
                      type: 'string',
                      enum: [
                        'message.received',
                        'call.missed',
                        'call.started',
                        'call.ended',
                        'user.online',
                        'user.offline',
                        'notification.sent',
                      ],
                    },
                    example: ['message.received', 'call.ended'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Webhook créé.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Webhook' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // WEBHOOKS - Item
    // -------------------------------------------------------------------------
    '/projects/{id}/webhooks/{wid}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'UUID du projet.',
        },
        {
          name: 'wid',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'UUID du webhook.',
        },
      ],
      patch: {
        tags: ['Webhooks'],
        summary: 'Met à jour un webhook',
        description: 'Met à jour l\'URL et/ou les événements d\'un webhook existant.',
        operationId: 'updateWebhook',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    format: 'uri',
                    example: 'https://api.monapp.com/webhooks/v2',
                  },
                  events: {
                    type: 'array',
                    minItems: 1,
                    items: {
                      type: 'string',
                      enum: [
                        'message.received',
                        'call.missed',
                        'call.started',
                        'call.ended',
                        'user.online',
                        'user.offline',
                        'notification.sent',
                      ],
                    },
                    example: ['message.received'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Webhook mis à jour.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Webhook' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
      delete: {
        tags: ['Webhooks'],
        summary: 'Supprime un webhook',
        description: 'Supprime le webhook et toutes ses deliveries (CASCADE).',
        operationId: 'deleteWebhook',
        security: [{ BearerAuth: [] }],
        responses: {
          '204': {
            description: 'Webhook supprimé.',
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // WEBHOOK DELIVERIES
    // -------------------------------------------------------------------------
    '/projects/{id}/webhooks/deliveries': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'UUID du projet.',
        },
      ],
      get: {
        tags: ['Webhooks'],
        summary: 'Historique des 100 dernières livraisons webhook',
        description:
          'Retourne les 100 dernières tentatives de livraison pour tous les webhooks du projet, triées par date décroissante.',
        operationId: 'listWebhookDeliveries',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Historique des livraisons.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    deliveries: {
                      type: 'array',
                      maxItems: 100,
                      items: { $ref: '#/components/schemas/WebhookDelivery' },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // STATISTICS
    // -------------------------------------------------------------------------
    '/projects/{id}/stats': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'UUID du projet.',
        },
      ],
      get: {
        tags: ['Statistiques'],
        summary: "Statistiques d'usage du projet",
        description:
          "Retourne les métriques agrégées du projet pour la période choisie : messages envoyés, appels effectués, utilisateurs actifs et appels API. Si aucune donnée, tous les compteurs valent 0 (pas d'erreur).",
        operationId: 'getProjectStats',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'period',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['today', '7d', '30d', '90d'],
              default: '30d',
            },
            description: 'Période de filtrage des statistiques. Valeur par défaut : `30d`.',
            example: '30d',
          },
        ],
        responses: {
          '200': {
            description: 'Statistiques du projet.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProjectStats' },
                example: {
                  period: '30d',
                  messages_sent: 1420,
                  calls_made: 87,
                  active_users: 234,
                  api_calls: 5678,
                },
              },
            },
          },
          '400': {
            description: 'Paramètre `period` invalide.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: {
                    code: 'INVALID_PERIOD',
                    message: 'Le paramètre period doit être : today, 7d, 30d ou 90d.',
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // DOCS (this endpoint itself)
    // -------------------------------------------------------------------------
    '/docs': {
      get: {
        tags: ['Documentation'],
        summary: 'Documentation OpenAPI 3.0 en JSON',
        description:
          'Retourne ce document OpenAPI 3.0 au format JSON. Aucune authentification requise. Peut être chargé dans Swagger UI, Redoc ou Postman.',
        operationId: 'getOpenApiDocs',
        security: [],
        responses: {
          '200': {
            description: 'Document OpenAPI 3.0 JSON.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  description: 'Document OpenAPI 3.0.3',
                },
              },
            },
          },
        },
      },
    },
  },

  // =========================================================================
  // TAGS (ordre d'affichage dans Swagger UI)
  // =========================================================================
  tags: [
    {
      name: 'Compte développeur',
      description: 'Gestion du compte développeur lié au profil SSO Palabre.',
    },
    {
      name: 'Projets',
      description: "CRUD des projets d'intégration. Chaque projet possède ses propres clés API et sa configuration.",
    },
    {
      name: 'Clés API',
      description:
        'Consultation et rotation des clés API (Publishable_Key et Secret_Key) par projet.',
    },
    {
      name: 'White-Label',
      description: "Configuration et récupération de la White_Label_Config (logo, couleurs, nom d'affichage).",
    },
    {
      name: 'Proxy - Fonctionnalités',
      description:
        "Routes proxy pour accéder aux fonctionnalités de communication Palabre (messagerie, appels WebRTC, vidéoconférence, push) via les clés de projet.",
    },
    {
      name: 'Webhooks',
      description:
        'Configuration des webhooks et consultation de l\'historique des livraisons. Les événements sont signés HMAC-SHA256.',
    },
    {
      name: 'Statistiques',
      description: "Métriques d'usage agrégées par projet et par période.",
    },
    {
      name: 'Documentation',
      description: 'Accès à cette documentation OpenAPI.',
    },
  ],
};
