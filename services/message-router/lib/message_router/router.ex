defmodule MessageRouter.Router do
  @moduledoc """
  Routeur central des messages.

  Décide pour chaque message :
  - Si le destinataire est en ligne → livraison directe via son Channel
  - Si hors ligne → enqueue dans Redis
  - Gère les accusés de livraison et de lecture
  - Pour les groupes → broadcast + enqueue pour les membres hors ligne

  Le contenu (ciphertext) n'est JAMAIS inspecté ici.
  Le Router ne voit que les métadonnées de routage.
  """

  alias MessageRouter.{Queue, Repo, PresenceClient}
  alias Phoenix.PubSub

  @pubsub MessageRouter.PubSub

  # ─── Routage d'un message direct (1:1) ───────────────────────────────────────

  @doc """
  Route un message vers son destinataire.
  Retourne :delivered | :queued | {:error, reason}
  """
  def route(msg) do
    # Persister d'abord (idempotence — si le serveur crash après persist mais
    # avant livraison, le Queue.Worker relivrera au redémarrage)
    with :ok <- Repo.persist_message(msg) do
      deliver_or_queue(msg)
    end
  end

  defp deliver_or_queue(msg) do
    case PresenceClient.get_status(msg.to) do
      {:ok, :online} ->
        # Pousser directement dans le Channel du destinataire via PubSub
        PubSub.broadcast(@pubsub, "user:#{msg.to}", {:incoming_message, msg})
        :delivered

      {:ok, :offline} ->
        Queue.push(msg.to, msg)
        :queued

      {:ok, :unknown} ->
        # Utilisateur inconnu du service de présence (jamais connecté)
        # On met quand même en file — il recevra au premier login
        Queue.push(msg.to, msg)
        :queued

      {:error, _} ->
        # Service de présence indisponible → fallback sur la file
        Queue.push(msg.to, msg)
        :queued
    end
  end

  # ─── Accusés de réception ────────────────────────────────────────────────────

  @doc """
  Envoie l'accusé de livraison à l'émetteur (2 traits gris).
  Appelé dès que le message est livré à l'appareil du destinataire.
  """
  def send_delivery_receipt(msg_id, from_user_id, delivered_to_user_id) do
    receipt = %{
      type:             "delivery_receipt",
      msg_id:           msg_id,
      delivered_to:     delivered_to_user_id,
      delivered_at:     :os.system_time(:millisecond)
    }
    PubSub.broadcast(@pubsub, "user:#{from_user_id}", {:incoming_message, receipt})
    Repo.update_message_status(msg_id, :delivered)
  end

  @doc """
  Envoie l'accusé de lecture à l'émetteur (2 traits bleus).
  Appelé quand le destinataire ouvre la conversation et envoie msg:ack_read.
  """
  def send_read_receipt(msg_id, from_user_id, read_by_user_id) do
    receipt = %{
      type:       "read_receipt",
      msg_id:     msg_id,
      read_by:    read_by_user_id,
      read_at:    :os.system_time(:millisecond)
    }
    PubSub.broadcast(@pubsub, "user:#{from_user_id}", {:incoming_message, receipt})
    Repo.update_message_status(msg_id, :read)
  end

  # ─── Membres hors ligne d'un groupe ──────────────────────────────────────────

  @doc """
  Retourne la liste des user_ids des membres d'un groupe qui sont hors ligne.
  Utilisé par RoomChannel pour enqueuer les messages pour les absents.
  """
  def get_offline_members(room_id, org_id) do
    all_members = Repo.get_room_members(room_id, org_id)
    online = PresenceClient.get_org_online_ids(org_id)
    all_members -- online
  end
end
