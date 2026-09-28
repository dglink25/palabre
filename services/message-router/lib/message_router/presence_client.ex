defmodule MessageRouter.PresenceClient do
  @moduledoc """
  Client HTTP vers le service de présence Erlang.

  Toutes les mutations de présence passent par ici.
  Les lectures de statut aussi (appel HTTP synchrone, ~1ms sur loopback).

  En cas d'indisponibilité du service de présence :
  - set_online/set_offline → on log, on continue (best-effort)
  - get_status → on retourne :unknown (le Router fallback sur la file)
  """
  use GenServer

  require Logger

  @presence_url Application.compile_env(:message_router, :presence_url, "http://localhost:4010")
  @secret Application.compile_env(:message_router, :internal_secret, "dev_internal_secret")

  def start_link(_), do: GenServer.start_link(__MODULE__, [], name: __MODULE__)

  @impl true
  def init(_), do: {:ok, []}

  # ─── API publique ─────────────────────────────────────────────────────────────

  def set_online(user_id, org_id, device_id, platform, socket_pid) do
    # Appel direct au registre Erlang via GenServer call
    # (le service de présence tourne sur le même noeud BEAM ou via distribution)
    case presence_available?() do
      true ->
        Presence.Registry.set_online(user_id, org_id, device_id, platform, socket_pid)
        # Notifier le QueueWorker qu'un utilisateur vient de se connecter
        Phoenix.PubSub.broadcast(MessageRouter.PubSub, "system:user_online", {:user_online, user_id})

      false ->
        # Fallback HTTP si les services tournent sur des noeuds séparés
        post_presence("/internal/presence/#{user_id}/online", %{
          org_id: org_id, device_id: device_id, platform: platform
        })
        Phoenix.PubSub.broadcast(MessageRouter.PubSub, "system:user_online", {:user_online, user_id})
    end
  end

  def set_offline(user_id, device_id) do
    case presence_available?() do
      true -> Presence.Registry.set_offline(user_id, device_id)
      false -> post_presence("/internal/presence/#{user_id}/offline", %{device_id: device_id})
    end
  end

  def heartbeat(user_id, device_id) do
    case presence_available?() do
      true -> Presence.Registry.heartbeat(user_id, device_id)
      false -> post_presence("/internal/presence/#{user_id}/heartbeat", %{device_id: device_id})
    end
  end

  def get_status(user_id) do
    case presence_available?() do
      true ->
        status = Presence.Registry.get_status(user_id)
        {:ok, normalize_status(status)}

      false ->
        case get_presence("/internal/presence/#{user_id}") do
          {:ok, %{"status" => "online"}}   -> {:ok, :online}
          {:ok, %{"status" => "offline"}}  -> {:ok, :offline}
          _                                -> {:ok, :unknown}
        end
    end
  end

  def get_org_online(org_id) do
    case presence_available?() do
      true ->
        members = Presence.Registry.online_members(org_id)
        {:ok, members}

      false ->
        case get_presence("/internal/presence/org/#{org_id}/online") do
          {:ok, %{"online" => members}} -> {:ok, members}
          _                              -> {:ok, []}
        end
    end
  end

  def get_org_online_ids(org_id) do
    case get_org_online(org_id) do
      {:ok, members} -> Enum.map(members, & &1.user_id)
      _ -> []
    end
  end

  def subscribe_org(org_id, pid) do
    case presence_available?() do
      true -> Presence.PubSub.subscribe(org_id); :ok
      false -> :ok  # fallback : polling côté channel (dégradé acceptable)
    end
    _ = pid
    :ok
  end

  def unsubscribe_org(org_id, _pid) do
    case presence_available?() do
      true -> Presence.PubSub.unsubscribe(org_id)
      false -> :ok
    end
  end

  # ─── Privé ───────────────────────────────────────────────────────────────────

  # Vérifie si le module Presence est disponible sur ce noeud BEAM
  # (true quand les deux services tournent dans le même release ou en distribution)
  defp presence_available? do
    Code.ensure_loaded?(Presence.Registry)
  end

  defp normalize_status({:online, _}), do: :online
  defp normalize_status({:offline, _}), do: :offline
  defp normalize_status(:unknown), do: :unknown

  defp get_presence(path) do
    case Req.get("#{@presence_url}#{path}", headers: internal_headers()) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      err ->
        Logger.warning("[PresenceClient] GET #{path} failed: #{inspect(err)}")
        {:error, :unavailable}
    end
  end

  defp post_presence(path, body) do
    case Req.post("#{@presence_url}#{path}", json: body, headers: internal_headers()) do
      {:ok, %{status: 200}} -> :ok
      err ->
        Logger.warning("[PresenceClient] POST #{path} failed: #{inspect(err)}")
        :ok  # best-effort
    end
  end

  defp internal_headers do
    [{"x-internal-secret", @secret}]
  end
end
