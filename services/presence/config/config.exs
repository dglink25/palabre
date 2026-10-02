import Config

# Valeurs statiques compilées - PAS de System.get_env ici.
# Toutes les variables d'environnement sont lues dans runtime.exs au démarrage.

config :presence,
  http_port: 4010

config :logger,
  level: :info,
  backends: [:console]

config :logger, :console,
  format: "[$level] $time $metadata$message\n",
  metadata: [:module]
