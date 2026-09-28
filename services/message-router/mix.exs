defmodule MessageRouter.MixProject do
  use Mix.Project

  def project do
    [
      app: :message_router,
      version: "0.1.0",
      elixir: "~> 1.16",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger, :crypto],
      mod: {MessageRouter.Application, []}
    ]
  end

  defp deps do
    [
      # Phoenix pour WebSocket + Cowboy
      {:phoenix, "~> 1.7"},
      {:phoenix_pubsub, "~> 2.1"},
      {:plug_cowboy, "~> 2.7"},
      {:jason, "~> 1.4"},
      # Client HTTP pour appeler le service de présence
      {:req, "~> 0.4"},
      # Redis pour la file de messages hors-ligne
      {:redix, "~> 1.3"},
      # UUID
      {:uniq, "~> 0.6"},
      # Client PostgreSQL (pour persister les messages)
      {:postgrex, "~> 0.17"},
      {:ecto_sql, "~> 3.11"},
      # Rate limiting
      {:hammer, "~> 6.2"},
      {:telemetry, "~> 1.2"}
    ]
  end
end
