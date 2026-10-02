defmodule MessageRouter.Application do
  @moduledoc """
  Service de routage de messages Palabre - Phoenix/Elixir sur BEAM.

  Ce service est LE point d'entrée temps réel de chaque client (web, mobile).
  Chaque connexion WebSocket est un processus Elixir léger (~4KB RAM).

  Architecture :
    Application.start
      └── Supervisor (one_for_one)
            ├── MessageRouter.Repo          - Ecto/PostgreSQL (persistance)
            ├── MessageRouter.Redis         - Redix (file hors-ligne)
            ├── MessageRouter.PubSub        - Phoenix.PubSub (fanout interne)
            ├── MessageRouter.PresenceClient- Client HTTP vers service Présence
            ├── MessageRouter.Endpoint      - Phoenix Endpoint (WebSocket + HTTP)
            └── MessageRouter.Queue.Worker  - Livraison des messages en attente

  Flux d'un message :
    1. Client envoie message chiffré via WebSocket
    2. UserChannel.handle_in reçoit le message
    3. MessageRouter.Router.route/1 décide la destination
    4a. Destinataire en ligne → envoi direct via son Channel
    4b. Destinataire hors ligne → enqueue dans Redis
    5. Accusé de réception envoyé à l'émetteur (1 trait)
    6. ACK de livraison envoyé à l'émetteur quand destinataire reçoit (2 traits)
    7. ACK de lecture envoyé à l'émetteur quand destinataire ouvre (2 traits bleus)
  """
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      MessageRouter.Repo,
      {Redix, {Application.get_env(:message_router, :redis_url, "redis://localhost:6379"), [name: :redix]}},
      {Phoenix.PubSub, name: MessageRouter.PubSub},
      MessageRouter.PresenceClient,
      MessageRouter.Endpoint,
      MessageRouter.Queue.Worker
    ]

    opts = [strategy: :one_for_one, name: MessageRouter.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
