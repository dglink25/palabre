defmodule Presence.Registry do
  @moduledoc """
  GenServer maître du registre de présence.

  Toutes les mutations passent ici (sérialisation des écritures).
  Les lectures passent directement par ETS (pas de GenServer call = pas de goulot).

  Responsabilités :
  - set_online/4       : enregistre une connexion
  - set_offline/2      : enregistre une déconnexion
  - heartbeat/2        : met à jour last_seen_at
  - monitor_socket/2   : surveille le PID WebSocket (détection crash)
  - handle_down/2      : appelé quand un PID monitored meurt (déconnexion propre)
  """
  use GenServer

  require Logger

  alias Presence.ETS.Manager, as: ETS
  alias Presence.PubSub

  # Map PID -> {user_id, device_id} pour retrouver le user quand le PID meurt
  defstruct pid_to_session: %{}

  def start_link(_), do: GenServer.start_link(__MODULE__, %__MODULE__{}, name: __MODULE__)

  # ─── API publique ────────────────────────────────────────────────────────────

  @doc """
  Enregistre un utilisateur comme en ligne.
  Appelé par le Message Router dès qu'un WebSocket s'authentifie.
  """
  def set_online(user_id, org_id, device_id, platform, socket_pid) do
    GenServer.call(__MODULE__, {:set_online, user_id, org_id, device_id, platform, socket_pid})
  end

  @doc """
  Enregistre un utilisateur comme hors ligne.
  Appelé explicitement lors d'une déconnexion propre (logout, fermeture tab).
  Aussi appelé automatiquement si le PID WebSocket meurt (crash, coupure réseau).
  """
  def set_offline(user_id, device_id) do
    GenServer.cast(__MODULE__, {:set_offline, user_id, device_id})
  end

  @doc """
  Reçoit un heartbeat du client (envoyé toutes les 30s).
  Met à jour last_seen_at sans changer le statut.
  """
  def heartbeat(user_id, device_id) do
    GenServer.cast(__MODULE__, {:heartbeat, user_id, device_id})
  end

  @doc """
  Retourne le statut d'un utilisateur.
  Lecture directe ETS — pas de GenServer call = O(1) sans contention.

  Retourne :
    {:online, connected_at}
    {:offline, last_seen_at}
    :unknown
  """
  def get_status(user_id) do
    devices = ETS.get_all_devices(user_id)
    case Enum.find(devices, &(&1.status == :online)) do
      nil ->
        case devices do
          [] -> :unknown
          [entry | _] -> {:offline, entry.last_seen_at}
        end
      entry -> {:online, entry.connected_at}
    end
  end

  def get_status(user_id, device_id) do
    case ETS.get(user_id, device_id) do
      {:ok, entry} -> {entry.status, entry.last_seen_at}
      :not_found -> :unknown
    end
  end

  @doc "Liste des membres en ligne pour une organisation (pour les indicateurs de présence)."
  def online_members(org_id) do
    ETS.get_org_online(org_id)
    |> Enum.map(& %{user_id: &1.user_id, device_id: &1.device_id, platform: &1.platform, connected_at: &1.connected_at})
  end

  # ─── GenServer callbacks ─────────────────────────────────────────────────────

  @impl true
  def init(state), do: {:ok, state}

  @impl true
  def handle_call({:set_online, user_id, org_id, device_id, platform, socket_pid}, _from, state) do
    now = DateTime.utc_now()
    entry = %ETS.Manager{
      user_id: user_id,
      org_id: org_id,
      device_id: device_id,
      socket_pid: socket_pid,
      status: :online,
      connected_at: now,
      last_seen_at: now,
      platform: platform
    }

    # 1. Écriture ETS (immédiate, visible par tous)
    ETS.put(entry)

    # 2. Écriture Mnesia (asynchrone, pour persistance)
    persist_async(entry)

    # 3. Surveiller le PID — si le processus WebSocket meurt, on recevra :DOWN
    ref = Process.monitor(socket_pid)
    new_state = put_in(state.pid_to_session[ref], {user_id, device_id})

    # 4. Diffuser le changement de présence à tous les intéressés
    PubSub.broadcast_presence_change(org_id, user_id, :online, now)

    Logger.debug("[Presence] #{user_id} en ligne (#{platform}, device: #{device_id})")
    {:reply, :ok, new_state}
  end

  @impl true
  def handle_cast({:set_offline, user_id, device_id}, state) do
    do_set_offline(user_id, device_id, state)
  end

  @impl true
  def handle_cast({:heartbeat, user_id, device_id}, state) do
    now = DateTime.utc_now()
    case ETS.get(user_id, device_id) do
      {:ok, entry} ->
        ETS.put(%{entry | last_seen_at: now})
        # Pas de broadcast pour les heartbeats — trop fréquent
      :not_found -> :ok
    end
    {:noreply, state}
  end

  # Appelé automatiquement quand un PID monitored meurt (crash ou coupure réseau)
  @impl true
  def handle_info({:DOWN, ref, :process, _pid, reason}, state) do
    case Map.pop(state.pid_to_session, ref) do
      {nil, state} ->
        {:noreply, state}

      {{user_id, device_id}, new_pid_map} ->
        Logger.debug("[Presence] PID mort (#{inspect(reason)}), déconnexion de #{user_id}/#{device_id}")
        do_set_offline(user_id, device_id, %{state | pid_to_session: new_pid_map})
    end
  end

  # ─── Privé ────────────────────────────────────────────────────────────────────

  defp do_set_offline(user_id, device_id, state) do
    now = DateTime.utc_now()
    case ETS.get(user_id, device_id) do
      {:ok, entry} ->
        updated = %{entry | status: :offline, last_seen_at: now, socket_pid: nil}
        ETS.put(updated)
        persist_async(updated)
        PubSub.broadcast_presence_change(entry.org_id, user_id, {:offline, now}, now)
        Logger.debug("[Presence] #{user_id} hors ligne (last seen: #{DateTime.to_iso8601(now)})")

      :not_found -> :ok
    end
    {:noreply, state}
  end

  defp persist_async(entry) do
    # Écriture Mnesia dans un Task séparé pour ne pas bloquer le GenServer
    Task.start(fn ->
      :mnesia.dirty_write({
        :presence_records,
        entry.user_id,
        entry.org_id,
        entry.device_id,
        entry.socket_pid,
        entry.status,
        entry.connected_at,
        entry.last_seen_at,
        entry.platform
      })
    end)
  end
end
