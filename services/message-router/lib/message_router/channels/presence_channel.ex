defmodule MessageRouter.Channels.PresenceChannel do
  use Phoenix.Channel

  @moduledoc """
  Channel de présence organisation - "presence:{org_id}".

  Utilisé pour recevoir en temps réel les changements de présence
  de tous les membres d'une organisation.

  À la jointure :
  - On s'abonne au PubSub du service de présence
  - On envoie l'état initial (qui est en ligne maintenant)

  Events sortants :
    "presence:state"   - état initial à la connexion
    "presence:update"  - changement d'un membre (en ligne / hors ligne)
  """

  alias MessageRouter.PresenceClient

  def join("presence:" <> org_id, _params, socket) do
    # Vérifier que l'utilisateur appartient à cette organisation
    if org_id == socket.assigns.org_id do
      send(self(), {:after_join, org_id})
      {:ok, socket |> Phoenix.Socket.assign(:presence_org_id, org_id)}
    else
      {:error, %{reason: "wrong_org"}}
    end
  end

  def handle_info({:after_join, org_id}, socket) do
    # S'abonner aux changements de présence via le service Présence
    :ok = PresenceClient.subscribe_org(org_id, self())

    # Envoyer l'état initial
    {:ok, online_members} = PresenceClient.get_org_online(org_id)
    push(socket, "presence:state", %{members: online_members})

    {:noreply, socket}
  end

  # Reçu depuis PresenceClient quand un membre change de statut
  def handle_info({:presence_change, org_id, user_id, status, timestamp}, socket) do
    payload = format_presence_event(user_id, status, timestamp)
    push(socket, "presence:update", payload)
    {:noreply, socket}
  end

  def terminate(_reason, socket) do
    if org_id = socket.assigns[:presence_org_id] do
      PresenceClient.unsubscribe_org(org_id, self())
    end
    :ok
  end

  defp format_presence_event(user_id, :online, timestamp) do
    %{user_id: user_id, status: "online", timestamp: timestamp}
  end
  defp format_presence_event(user_id, {:offline, last_seen}, _timestamp) do
    diff = DateTime.diff(DateTime.utc_now(), last_seen, :second)
    label = cond do
      diff < 60    -> "il y a moins d'une minute"
      diff < 3600  -> "il y a #{div(diff, 60)} min"
      diff < 86400 -> "il y a #{div(diff, 3600)} h"
      true         -> "il y a #{div(diff, 86400)} j"
    end
    %{user_id: user_id, status: "offline", last_seen: DateTime.to_iso8601(last_seen), label: label}
  end
end
