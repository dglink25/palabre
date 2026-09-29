defmodule Presence.Heartbeat.Sweeper do
  @moduledoc """
  Processus de nettoyage des connexions zombies.

  Un client peut disparaître sans envoyer de déconnexion explicite
  (coupure réseau brutale, kill -9, crash OS). Le monitor PID détecte
  les crashes du processus WebSocket côté serveur, mais si le serveur
  lui-même redémarre, les anciens PIDs sont invalides.

  Ce Sweeper tourne toutes les 60 secondes et marque hors ligne tout
  utilisateur dont last_seen_at > @zombie_threshold.

  Valeur par défaut : 90 secondes (le client envoie un heartbeat toutes les 30s).
  Si on n'a pas vu de heartbeat depuis 90s, la connexion est morte.
  """
  use GenServer

  require Logger

  alias Presence.Registry

  # 90 secondes sans heartbeat = zombie
  @zombie_threshold_seconds 90
  # Scan toutes les 60 secondes
  @sweep_interval_ms 60_000

  def start_link(_), do: GenServer.start_link(__MODULE__, [], name: __MODULE__)

  @impl true
  def init(_) do
    schedule_sweep()
    {:ok, []}
  end

  @impl true
  def handle_info(:sweep, state) do
    sweep()
    schedule_sweep()
    {:noreply, state}
  end

  defp sweep do
    threshold = DateTime.add(DateTime.utc_now(), -@zombie_threshold_seconds, :second)

    # Lecture ETS directe — pas de GenServer call
    zombies =
      :ets.select(:presence_ets, [
        {{{:_, :_}, :"$1"},
         # En ligne mais pas vu depuis > threshold
         [{:==, {:map_get, :status, :"$1"}, :online},
          {:<, {:map_get, :last_seen_at, :"$1"}, threshold}],
         [:"$1"]}
      ])

    if length(zombies) > 0 do
      Logger.warning("[Sweeper] #{length(zombies)} connexion(s) zombie détectée(s)")
    end

    Enum.each(zombies, fn entry ->
      Logger.debug("[Sweeper] Déconnexion zombie: #{entry.user_id}/#{entry.device_id}")
      Registry.set_offline(entry.user_id, entry.device_id)
    end)
  end

  defp schedule_sweep do
    Process.send_after(self(), :sweep, @sweep_interval_ms)
  end
end
