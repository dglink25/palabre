defmodule CallSignal.PubSubHelper do
  @moduledoc """
  Helper pour notifier les utilisateurs via le message-router.

  Deux modes selon la topologie de déploiement :

  Mode co-localisé (même cluster BEAM) :
    On diffuse directement via Phoenix.PubSub partagé entre les services.
    Le message-router reçoit l'event et le pousse via WebSocket.

  Mode distribué (services sur des noeuds séparés) :
    On appelle l'API interne HTTP du message-router.
    Le message-router reçoit via son endpoint interne et pousse via WebSocket.
  """

  require Logger

  @message_router_url Application.compile_env(
    :call_signal, :message_router_url, "http://localhost:4020"
  )
  @internal_secret Application.compile_env(
    :call_signal, :internal_secret, "dev_internal_secret"
  )

  @doc "Notifie un utilisateur spécifique d'un événement d'appel."
  def notify_user(user_id, event, payload) do
    if beam_collocated?() do
      Phoenix.PubSub.broadcast(
        MessageRouter.PubSub,
        "user:#{user_id}",
        {:call_event, event, payload}
      )
    else
      post_internal("/internal/push/user/#{user_id}", %{event: event, payload: payload})
    end
  end

  @doc "Notifie tous les membres d'un groupe d'un événement d'appel."
  def notify_room(room_id, org_id, event, payload) do
    if beam_collocated?() do
      Phoenix.PubSub.broadcast(
        MessageRouter.PubSub,
        "room:#{room_id}",
        {:call_event, event, payload}
      )
    else
      post_internal("/internal/push/room/#{room_id}", %{
        event: event,
        payload: payload,
        org_id: org_id
      })
    end
  end

  defp beam_collocated? do
    Code.ensure_loaded?(MessageRouter.PubSub)
  end

  defp post_internal(path, body) do
    case Req.post(
      "#{@message_router_url}#{path}",
      json: body,
      headers: [{"x-internal-secret", @internal_secret}]
    ) do
      {:ok, %{status: 200}} -> :ok
      err ->
        Logger.warning("[PubSubHelper] POST #{path} failed: #{inspect(err)}")
        :ok
    end
  end
end
