defmodule Presence.HTTP.Router do
  @moduledoc """
  API HTTP interne du service de présence.
  Accessible UNIQUEMENT depuis les autres services (pas exposée à l'extérieur).
  Port 4010 - protégé par un secret partagé entre services.

  Routes :
    GET  /internal/presence/:user_id           - statut d'un utilisateur
    GET  /internal/presence/org/:org_id/online - membres en ligne d'une org
    POST /internal/presence/:user_id/heartbeat - heartbeat depuis le message router
    GET  /health                               - healthcheck Docker
  """
  use Plug.Router

  plug :match
  plug Plug.Parsers, parsers: [:json], json_decoder: Jason
  plug :dispatch

  # ─── Routes ──────────────────────────────────────────────────────────────────

  # /health - pas de secret requis (Docker healthcheck, Kubernetes probe)
  get "/health" do
    send_json(conn, 200, %{status: "ok", service: "presence", node: node()})
  end

  get "/internal/presence/:user_id" do
    with :ok <- check_secret(conn) do
      status = Presence.Registry.get_status(conn.params["user_id"])
      payload = format_status(conn.params["user_id"], status)
      send_json(conn, 200, payload)
    else
      {:error, conn} -> conn
    end
  end

  get "/internal/presence/org/:org_id/online" do
    with :ok <- check_secret(conn) do
      members = Presence.Registry.online_members(conn.params["org_id"])
      send_json(conn, 200, %{org_id: conn.params["org_id"], online: members, count: length(members)})
    else
      {:error, conn} -> conn
    end
  end

  post "/internal/presence/:user_id/heartbeat" do
    with :ok <- check_secret(conn) do
      device_id = conn.body_params["device_id"] || "default"
      Presence.Registry.heartbeat(conn.params["user_id"], device_id)
      send_json(conn, 200, %{ok: true})
    else
      {:error, conn} -> conn
    end
  end

  match _ do
    send_json(conn, 404, %{error: "not_found"})
  end

  # ─── Plugs ────────────────────────────────────────────────────────────────────

  defp check_secret(conn) do
    expected = Application.get_env(:presence, :internal_secret, "dev_internal_secret")
    actual = Plug.Conn.get_req_header(conn, "x-internal-secret") |> List.first()
    if actual == expected do
      :ok
    else
      {:error, conn |> send_json(401, %{error: "unauthorized"}) |> Plug.Conn.halt()}
    end
  end

  # ─── Helpers ─────────────────────────────────────────────────────────────────

  defp send_json(conn, status, body) do
    conn
    |> Plug.Conn.put_resp_content_type("application/json")
    |> Plug.Conn.send_resp(status, Jason.encode!(body))
  end

  defp format_status(user_id, :unknown) do
    %{user_id: user_id, status: "unknown"}
  end

  defp format_status(user_id, {:online, connected_at}) do
    %{user_id: user_id, status: "online", connected_at: DateTime.to_iso8601(connected_at)}
  end

  defp format_status(user_id, {:offline, last_seen_at}) do
    %{
      user_id: user_id,
      status: "offline",
      last_seen_at: DateTime.to_iso8601(last_seen_at),
      last_seen_label: human_last_seen(last_seen_at)
    }
  end

  defp human_last_seen(last_seen_at) do
    diff = DateTime.diff(DateTime.utc_now(), last_seen_at, :second)
    cond do
      diff < 60 -> "il y a moins d'une minute"
      diff < 3600 -> "il y a #{div(diff, 60)} min"
      diff < 86400 -> "il y a #{div(diff, 3600)} h"
      true -> "il y a #{div(diff, 86400)} j"
    end
  end
end
