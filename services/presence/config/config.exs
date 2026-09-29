import Config

config :presence,
  http_port: String.to_integer(System.get_env("PRESENCE_HTTP_PORT", "4010")),
  internal_secret: System.get_env("INTERNAL_SERVICES_SECRET", "dev_internal_secret"),
  # Bandit comme adaptateur HTTP (pas de cowboy/cowlib)
  http_adapter: {Bandit, port: String.to_integer(System.get_env("PRESENCE_HTTP_PORT", "4010"))}

config :logger,
  level: :info,
  backends: [:console]

config :logger, :console,
  format: "[$level] $time $metadata$message\n",
  metadata: [:module]
