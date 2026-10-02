defmodule Presence.ETS.Manager do
  @moduledoc """
  Crée et possède la table ETS de présence chaude.

  ETS (Erlang Term Storage) = lecture en mémoire en O(1), thread-safe en lecture
  simultanée par N processus, sans verrou.

  Cette table est le "cache chaud" : les lookups de présence ("est-il en ligne ?")
  n'ont PAS besoin de passer par Mnesia (disque). ETS est mis à jour en temps réel
  à chaque connexion/déconnexion, Mnesia est mis à jour de façon asynchrone et
  sert uniquement à la persistance entre redémarrages.

  Structure ETS :
    { {user_id, device_id} => %PresenceEntry{} }
  """
  use GenServer

  @table :presence_ets

  defstruct [:user_id, :org_id, :device_id, :socket_pid, :status, :connected_at, :last_seen_at, :platform]

  def start_link(_) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @impl true
  def init(_) do
    # public = lisible par tous les processus
    # named_table = accessible par nom sans PID
    # {keypos, 1} = la clé est le premier élément du tuple
    :ets.new(@table, [:set, :public, :named_table, {:read_concurrency, true}])
    {:ok, []}
  end

  # API publique ETS - appelable depuis n'importe quel processus, pas de GenServer call

  def put(entry) do
    key = {entry.user_id, entry.device_id}
    :ets.insert(@table, {key, entry})
  end

  def get(user_id, device_id) do
    case :ets.lookup(@table, {user_id, device_id}) do
      [{_key, entry}] -> {:ok, entry}
      [] -> :not_found
    end
  end

  def get_all_devices(user_id) do
    :ets.tab2list(@table)
    |> Enum.filter(fn {{uid, _did}, _entry} -> uid == user_id end)
    |> Enum.map(fn {_key, entry} -> entry end)
  end

  def get_org_online(org_id) do
    :ets.tab2list(@table)
    |> Enum.filter(fn {_key, entry} ->
      entry.org_id == org_id and entry.status == :online
    end)
    |> Enum.map(fn {_key, entry} -> entry end)
  end

  def delete(user_id, device_id) do
    :ets.delete(@table, {user_id, device_id})
  end

  def count_online do
    :ets.tab2list(@table)
    |> Enum.count(fn {_key, entry} -> entry.status == :online end)
  end
end
