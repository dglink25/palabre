defmodule CallSignal.HTTP.Router do
  use Plug.Router

  plug :match
  plug Plug.Parsers, parsers: [:json], json_decoder: Jason
  plug :dispatch

  get "/health" do
    send_json(conn, 200, %{
      status:       "ok",
      service:      "call-signal",
      active_calls: CallSignal.CallRegistry.count_active()
    })
  end

  get "/ws/info" do
    host = Application.get_env(:call_signal, :public_host, "localhost")
    port = Application.get_env(:call_signal, :http_port, 4040)
    send_json(conn, 200, %{
      websocket_url: "ws://#{host}:#{port}/signal/websocket",
      ring_timeout_s: 45
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
