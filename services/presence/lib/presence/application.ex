defmodule Presence.Application do
  @moduledoc """
  Service de présence Palabre — construit sur Erlang/OTP.

  Responsabilités :
  - Tenir un registre en temps réel de qui est en ligne (ETS, microseconde)
  - Persister le dernier instant de connexion (Mnesia, résiste aux redémarrages)
  - Exposer une API interne HTTP (port 4010) pour les autres services
  - Diffuser les changements de présence en PubSub interne

  Architecture :
    Application.start
      └── Supervisor (one_for_one)
            ├── Presence.Mnesia.Setup       — initialise les tables Mnesia
            ├── Presence.ETS.Manager        — crée et possède la table ETS
            ├── Presence.Registry           — GenServer maître du registre
            ├── Presence.PubSub             — diffusion interne des events
            ├── Presence.Heartbeat.Sweeper  — supprime les connexions zombies
            └── Presence.HTTP.Server        — API interne Bandit
  """
  use Application

  @impl true
  def start(_type, _args) do
    :ok = Presence.Mnesia.Setup.ensure_schema()

    children = [
      Presence.ETS.Manager,
      Presence.Mnesia.Setup,
      Presence.PubSub,
      Presence.Registry,
      Presence.Heartbeat.Sweeper,
      {Bandit,
       scheme: :http,
       plug: Presence.HTTP.Router,
       port: Application.get_env(:presence, :http_port, 4010)}
    ]

    opts = [strategy: :one_for_one, name: Presence.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
