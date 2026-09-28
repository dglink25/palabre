defmodule CallSignal.Timeout.Sweeper do
  @moduledoc """
  Expire les appels sans réponse et les appels actifs trop longs.

  Règles :
  - Appel en sonnerie depuis > 45s → :missed
  - Appel actif depuis > 4h (sécurité anti-fuite mémoire) → :ended
  """
  use GenServer

  require Logger
  alias CallSignal.{CallRegistry, PubSubHelper}

  @sweep_interval_ms  30_000   # toutes les 30s
  @ring_timeout_s         45   # 45s sans réponse = manqué
  @max_call_duration_s 14400   # 4h max par appel

  def start_link(_), do: GenServer.start_link(__MODULE__, [], name: __MODULE__)

  @impl true
  def init(_) do
    schedule_sweep()
    {:ok, []}
  end

  @impl true
  def handle_info(:sweep, state) do
    sweep_ringing()
    sweep_stale_active()
    schedule_sweep()
    {:noreply, state}
  end

  defp sweep_ringing do
    expired = CallRegistry.get_ringing_calls_older_than(@ring_timeout_s)
    Enum.each(expired, fn call ->
      Logger.debug("[Sweeper] Appel #{call.id} marqué manqué (timeout sonnerie)")
      updated = %{call | status: :missed, ended_at: DateTime.utc_now()}
      CallRegistry.update(updated)
      PubSubHelper.notify_user(call.caller_id, "call:missed", %{
        call_id: call.id,
        to: call.callee_id
      })
      if call.callee_id do
        PubSubHelper.notify_user(call.callee_id, "call:missed", %{
          call_id: call.id,
          from: call.caller_id
        })
      end
    end)
  end

  defp sweep_stale_active do
    cutoff = DateTime.add(DateTime.utc_now(), -@max_call_duration_s, :second)
    stale = :ets.select(:call_registry_ets, [
      {{:_, :"$1"},
       [{:==, {:map_get, :status, :"$1"}, :active},
        {:<, {:map_get, :started_at, :"$1"}, cutoff}],
       [:"$1"]}
    ])
    Enum.each(stale, fn call ->
      Logger.warning("[Sweeper] Appel #{call.id} expiré (> #{@max_call_duration_s}s)")
      updated = %{call | status: :ended, ended_at: DateTime.utc_now()}
      CallRegistry.update(updated)
    end)
  end

  defp schedule_sweep do
    Process.send_after(self(), :sweep, @sweep_interval_ms)
  end
end
