defmodule CallSignal.MixProject do
  use Mix.Project

  def project do
    [
      app: :call_signal,
      version: "0.1.0",
      elixir: "~> 1.16",
      start_permanent: Mix.env() == :prod,
      releases: [
        call_signal: [
          validate_compile_env: false
        ]
      ],
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger, :crypto],
      mod: {CallSignal.Application, []}
    ]
  end

  defp deps do
    [
      {:phoenix, "~> 1.7"},
      {:phoenix_pubsub, "~> 2.1"},
      {:bandit, "~> 1.5"},
      {:jason, "~> 1.4"},
      {:req, "~> 0.4"},
      {:uniq, "~> 0.6"},
      {:telemetry, "~> 1.2"}
    ]
  end
end
