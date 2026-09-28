defmodule CallSignal.CallRegistry do
  @moduledoc """
  Registre ETS des appels actifs.

  Structure d'un appel :
    %Call{
      id:           UUID de l'appel (généré à l'invitation)
      org_id:       Organisation (isolation multi-tenant)
      caller_id:    user_id de l'initiateur
      callee_id:    user_id du destinataire (nil si groupe)
      room_id:      room_id pour les appels de groupe (nil si 1:1)
      type:         :audio | :video
      scope:        :direct | :group
      status:       :ringing | :active | :ended | :rejected | :missed
      participants: MapSet des user_ids connectés
      sfu_room_id:  identifiant de la room Mediasoup (nil si 1:1)
      started_at:   DateTime
      answered_at:  DateTime | nil
      ended_at:     DateTime | nil
    }
  """
  use GenServer

  require Logger

  @table :call_registry_ets

  defstruct [
    :id, :org_id, :caller_id, :callee_id, :room_id,
    :type, :scope, :status,
    :sfu_room_id, :started_at, :answered_at, :ended_at,
    participants: MapSet.new()
  ]

  def start_link(_), do: GenServer.start_link(__MODULE__, [], name: __MODULE__)

  @impl true
  def init(_) do
    :ets.new(@table, [:set, :public, :named_table, {:read_concurrency, true}])
    {:ok, []}
  end

  # ── API publique ─────────────────────────────────────────────────────────────

  def create(call) do
    :ets.insert(@table, {call.id, call})
    :ok
  end

  def get(call_id) do
    case :ets.lookup(@table, call_id) do
      [{_, call}] -> {:ok, call}
      []          -> :not_found
    end
  end

  def update(call) do
    :ets.insert(@table, {call.id, call})
    :ok
  end

  def delete(call_id) do
    :ets.delete(@table, call_id)
  end

  def add_participant(call_id, user_id) do
    case get(call_id) do
      {:ok, call} ->
        updated = %{call | participants: MapSet.put(call.participants, user_id)}
        update(updated)
        {:ok, updated}
      :not_found -> :not_found
    end
  end

  def remove_participant(call_id, user_id) do
    case get(call_id) do
      {:ok, call} ->
        updated = %{call | participants: MapSet.delete(call.participants, user_id)}
        update(updated)
        {:ok, updated}
      :not_found -> :not_found
    end
  end

  def get_active_calls_for_user(user_id) do
    :ets.select(@table, [
      {{:_, :"$1"},
       [{:or,
         {:==, {:map_get, :caller_id, :"$1"}, user_id},
         {:==, {:map_get, :callee_id, :"$1"}, user_id}},
        {:!=, {:map_get, :status, :"$1"}, :ended}],
       [:"$1"]}
    ])
  end

  def get_ringing_calls_older_than(seconds) do
    cutoff = DateTime.add(DateTime.utc_now(), -seconds, :second)
    :ets.select(@table, [
      {{:_, :"$1"},
       [{:==, {:map_get, :status, :"$1"}, :ringing},
        {:<, {:map_get, :started_at, :"$1"}, cutoff}],
       [:"$1"]}
    ])
  end

  def count_active do
    :ets.select_count(@table, [
      {{:_, :"$1"},
       [{:==, {:map_get, :status, :"$1"}, :active}],
       [true]}
    ])
  end
end
