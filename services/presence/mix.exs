defmodule Presence.MixProject do
  use Mix.Project

  def project do
    [
      app: :presence,
      version: "0.1.0",
      elixir: "~> 1.16",
      start_permanent: Mix.env() == :prod,
      releases: [
        presence: [
          validate_compile_env: false
        ]
      ],
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger, :mnesia],
      mod: {Presence.Application, []}
    ]
  end

  defp deps do
    [
      # HTTP server pur Elixir — pas de cowboy/cowlib (incompatibles Alpine/rebar3)
      {:bandit, "~> 1.5"},
      {:jason, "~> 1.4"},
      # Distribution Erlang entre noeuds
      {:libcluster, "~> 3.3"},
      # Métriques
      {:telemetry, "~> 1.2"}
    ]
  end
end
