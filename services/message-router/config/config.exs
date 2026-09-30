import Config

# Valeurs statiques compilées — PAS de System.get_env ici.
# Toutes les variables d'environnement sont lues dans runtime.exs au démarrage.

config :message_router, MessageRouter.Repo,
  pool_size: 10,
  ssl: false

config :message_router, MessageRouter.Endpoint,
  server: true,
  adapter: Bandit.PhoenixAdapter

config :message_router,
  http_port: 4020

config :phoenix, :json_library, Jason

config :logger,
  level: :info,
  backends: [:console]

config :logger, :console,
  format: "[$level] $time $metadata$message\n",
  metadata: [:module, :request_id]

config :hammer,
  backend: {Hammer.Backend.ETS,
            [expiry_ms: 60_000 * 60 * 2,
             cleanup_interval_ms: 60_000 * 10]}

config :message_router, MessageRouter.Endpoint,
  server: true,
  adapter: Bandit.PhoenixAdapter,
  render_errors: [formats: [json: MessageRouter.ErrorJSON], layout: false]
