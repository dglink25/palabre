import Config

config :message_router, MessageRouter.Repo,
  url:      System.get_env("DATABASE_URL", "postgres://palabre:palabre@localhost:5432/palabre"),
  pool_size: String.to_integer(System.get_env("DB_POOL_SIZE", "10")),
  ssl:      false

config :message_router, MessageRouter.Endpoint,
  url:     [host: System.get_env("PUBLIC_HOST", "localhost")],
  http:    [port: String.to_integer(System.get_env("MESSAGE_ROUTER_PORT", "4020"))],
  adapter: Bandit.PhoenixAdapter,
  server:  true,
  secret_key_base: System.get_env("PHOENIX_SECRET_KEY_BASE",
    "palabre_dev_secret_key_base_change_in_prod_must_be_64_chars_minimum_xxxxx")

config :message_router,
  jwt_secret:       System.get_env("JWT_ACCESS_SECRET", "change_me_access_secret"),
  redis_url:        System.get_env("REDIS_URL", "redis://localhost:6379"),
  presence_url:     System.get_env("PRESENCE_SERVICE_URL", "http://localhost:4010"),
  internal_secret:  System.get_env("INTERNAL_SERVICES_SECRET", "dev_internal_secret"),
  http_port:        String.to_integer(System.get_env("MESSAGE_ROUTER_PORT", "4020")),
  public_host:      System.get_env("PUBLIC_HOST", "localhost")

config :phoenix, :json_library, Jason

config :logger,
  level:    :info,
  backends: [:console]

config :logger, :console,
  format:   "[$level] $time $metadata$message\n",
  metadata: [:module, :request_id]
