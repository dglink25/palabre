import Config

# Valeurs statiques compilées — PAS de System.get_env ici.
# Toutes les variables d'environnement sont lues dans runtime.exs au démarrage.

config :call_signal, CallSignal.Endpoint,
  server:  true,
  adapter: Bandit.PhoenixAdapter

config :call_signal,
  http_port: 4040

config :phoenix, :json_library, Jason

config :logger,
  level:    :info,
  backends: [:console]

config :logger, :console,
  format:   "[$level] $time $metadata$message\n",
  metadata: [:module]
