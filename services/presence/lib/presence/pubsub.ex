defmodule Presence.PubSub do
  @moduledoc """
  PubSub interne pour la diffusion des changements de présence.

  Utilise :pg (Process Groups) natif à Erlang/OTP 23+.
  Aucune dépendance externe — pas de Redis, pas de RabbitMQ.

  Fonctionnement :
  - Le Message Router s'abonne au groupe "presence:{org_id}"
  - Quand un utilisateur se connecte/déconnecte, on broadcast à tous les
    processus abonnés à son organisation
  - Le Message Router reçoit l'événement et le pousse via WebSocket
    à tous les clients connectés de l'organisation concernée

  Format des événements diffusés :
    {:presence_change, org_id, user_id, status, timestamp}
    status = :online | {:offline, last_seen_at}
  """
  use GenServer

  @pg_scope :presence_pubsub

  def start_link(_) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @impl true
  def init(_) do
    :pg.start_link(@pg_scope)
    {:ok, []}
  end

  # ─── API publique ─────────────────────────────────────────────────────────────

  @doc "Abonne le processus appelant aux changements de présence d'une organisation."
  def subscribe(org_id) do
    :pg.join(@pg_scope, group_name(org_id), self())
  end

  @doc "Désabonne le processus appelant."
  def unsubscribe(org_id) do
    :pg.leave(@pg_scope, group_name(org_id), self())
  end

  @doc "Diffuse un changement de présence à tous les abonnés de l'organisation."
  def broadcast_presence_change(org_id, user_id, status, timestamp) do
    event = {:presence_change, org_id, user_id, status, timestamp}
    members = :pg.get_members(@pg_scope, group_name(org_id))
    Enum.each(members, &send(&1, event))
  end

  # ─── Privé ───────────────────────────────────────────────────────────────────

  defp group_name(org_id), do: "org:#{org_id}"
end
