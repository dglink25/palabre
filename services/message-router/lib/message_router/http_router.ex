defmodule MessageRouter.HTTP.Router do
  use Plug.Router

  @moduledoc """
  Routes HTTP du Message Router.
  - /health                   - healthcheck Docker/orchestrateur
  - /ws/info                  - infos de connexion WebSocket pour les clients
  - /internal/messages/deliver - livraison d'un message entrant (depuis l'agent tenant)
  - /internal/agent/mode       - changement de mode réseau (full/degraded)
  """

  @internal_secret Application.compile_env(:message_router, :internal_secret, "dev_internal_secret")

  plug :match
  plug Plug.Parsers, parsers: [:json], json_decoder: Jason
  plug :dispatch

  # ── Healthcheck ──────────────────────────────────────────────────────────────

  get "/health" do
    send_json(conn, 200, %{
      status: "ok",
      service: "message-router",
      node: node(),
    })
  end

  # ── Info connexion WebSocket ─────────────────────────────────────────────────

  get "/ws/info" do
    host = Application.get_env(:message_router, :public_host, "localhost")
    port = Application.get_env(:message_router, :http_port, 4020)
    send_json(conn, 200, %{
      websocket_url: "ws://#{host}:#{port}/socket/websocket",
      heartbeat_interval_ms: 30_000,
      reconnect_after_ms: [1000, 2000, 5000, 10_000]
    })
  end

  # ── Livraison d'un message entrant depuis l'agent tenant ─────────────────────
  # Appelé par l'agent quand il reçoit un message du serveur central destiné
  # à un utilisateur dans ce réseau local.

  post "/internal/messages/deliver" do
    with :ok <- check_internal_secret(conn),
         msg when is_map(msg) <- conn.body_params do
      require Logger
      Logger.debug("[HTTP.Router] Message entrant recu depuis l'agent : #{inspect(Map.get(msg, "id"))}")

      # Livrer directement au destinataire via PubSub s'il est en ligne
      to_user = Map.get(msg, "to") || Map.get(msg, "to_user_id")
      if to_user do
        Phoenix.PubSub.broadcast(
          MessageRouter.PubSub,
          "user:#{to_user}",
          {:incoming_message, atomize_keys(msg)}
        )
        # Si hors ligne, mettre en file Redis
        case MessageRouter.PresenceClient.get_status(to_user) do
          {:ok, :offline} -> MessageRouter.Queue.push(to_user, atomize_keys(msg))
          {:ok, :unknown} -> MessageRouter.Queue.push(to_user, atomize_keys(msg))
          _ -> :ok
        end
        send_json(conn, 200, %{ok: true, delivered_to: to_user})
      else
        send_json(conn, 400, %{error: "missing_to_field"})
      end
    else
      {:error, :unauthorized} -> send_json(conn, 401, %{error: "unauthorized"})
      _ -> send_json(conn, 400, %{error: "invalid_payload"})
    end
  end

  # ── Changement de mode réseau depuis l'agent ─────────────────────────────────
  # Appelé quand l'agent détecte que le tunnel WireGuard change d'état.
  # mode = "full" | "degraded" | "restricted"

  post "/internal/agent/mode" do
    with :ok <- check_internal_secret(conn) do
      mode = conn.body_params["mode"] || "full"
      directives = conn.body_params["directives"] || %{}
      require Logger
      Logger.info("[HTTP.Router] Mode reseau change : #{mode} - directives=#{inspect(directives)}")

      # Broadcaster le changement de mode à tous les channels connectés
      Phoenix.PubSub.broadcast(
        MessageRouter.PubSub,
        "system:network_mode",
        {:network_mode_changed, mode, directives}
      )

      send_json(conn, 200, %{ok: true, mode: mode})
    else
      {:error, :unauthorized} -> send_json(conn, 401, %{error: "unauthorized"})
    end
  end

  # ── Sync d'un message venant du central (via agent) ──────────────────────────

  post "/internal/messages/sync" do
    with :ok <- check_internal_secret(conn) do
      msg = conn.body_params
      to_user = Map.get(msg, "to") || Map.get(msg, "to_user_id")
      if to_user do
        MessageRouter.Queue.push(to_user, atomize_keys(msg))
        send_json(conn, 200, %{ok: true, queued_for: to_user})
      else
        send_json(conn, 400, %{error: "missing_to_field"})
      end
    else
      {:error, :unauthorized} -> send_json(conn, 401, %{error: "unauthorized"})
    end
  end

  match _ do
    send_json(conn, 404, %{error: "not_found"})
  end

  # ─── Helpers ──────────────────────────────────────────────────────────────────

  defp check_internal_secret(conn) do
    secret = Plug.Conn.get_req_header(conn, "x-internal-secret") |> List.first()
    if secret == @internal_secret, do: :ok, else: {:error, :unauthorized}
  end

  defp send_json(conn, status, body) do
    conn
    |> Plug.Conn.put_resp_content_type("application/json")
    |> Plug.Conn.send_resp(status, Jason.encode!(body))
  end

  defp atomize_keys(map) when is_map(map) do
    Map.new(map, fn {k, v} -> {String.to_atom(k), v} end)
  end
end
