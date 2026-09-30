defmodule MessageRouter.HTTP.Router do
  use Plug.Router

  @moduledoc """
  Routes HTTP du Message Router.
  - /health       — healthcheck Docker/orchestrateur
  - /ws/info      — infos de connexion WebSocket pour les clients
  """

  plug :match
  plug Plug.Parsers, parsers: [:json], json_decoder: Jason
  plug :dispatch

  get "/health" do
    send_json(conn, 200, %{
      status: "ok",
      service: "message-router",
      node: node(),
      connections: Registry.count(MessageRouter.PubSub)
      
    })
  end

  get "/ws/info" do
    host = Application.get_env(:message_router, :public_host, "localhost")
    port = Application.get_env(:message_router, :http_port, 4020)
    send_json(conn, 200, %{
      websocket_url: "ws://#{host}:#{port}/socket/websocket",
      heartbeat_interval_ms: 30_000,
      reconnect_after_ms: [1000, 2000, 5000, 10_000]
    })
  end

  match _ do
    send_json(conn, 404, %{error: "not_found"})
  end

  defp send_json(conn, status, body) do
    conn
    |> Plug.Conn.put_resp_content_type("application/json")
    |> Plug.Conn.send_resp(status, Jason.encode!(body))
  end
end
