defmodule MessageRouter.Channels.UserChannel do
  use Phoenix.Channel

  @moduledoc """
  Channel personnel de chaque utilisateur - "user:{user_id}".

  Un seul utilisateur peut rejoindre ce channel (on vérifie que
  le user_id du token correspond au user_id du channel).

  Events entrants (client → serveur) :
    "msg:send"       - envoyer un message direct (1:1)
    "msg:ack_read"   - signaler qu'un message a été lu (2 traits bleus)
    "heartbeat"      - keepalive toutes les 30s

  Events sortants (serveur → client) :
    "msg:receive"    - message entrant
    "msg:sent_ack"   - accusé de réception (1 trait)
    "msg:delivered"  - livré à l'appareil (2 traits gris)
    "msg:read"       - lu par le destinataire (2 traits bleus)
    "presence:update"- changement de présence d'un contact
    "error"          - erreur applicative
  """

  alias MessageRouter.{Router, Queue, PresenceClient}

  # ─── Jointure ────────────────────────────────────────────────────────────────

  def join("user:" <> user_id, _params, socket) do
    # Sécurité : un utilisateur ne peut rejoindre QUE son propre channel
    if user_id == socket.assigns.user_id do
      # Livrer les messages en attente dès la connexion
      send(self(), :deliver_pending)
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  # ─── Events entrants ─────────────────────────────────────────────────────────

  @doc """
  Envoyer un message direct (1:1).

  Payload attendu :
  {
    "id":         "uuid_généré_côté_client",  -- idempotence
    "to":         "user_id_destinataire",
    "ciphertext": "base64_chiffré_Signal",
    "sender_key_id": "key_id",
    "type":       "text" | "media_ref" | "call_signal",
    "timestamp":  1234567890123
  }

  Le serveur NE DÉCHIFFRE JAMAIS le ciphertext.
  Il route le blob opaque tel quel.
  """
  def handle_in("msg:send", payload, socket) do
    with :ok <- validate_message(payload),
         :ok <- check_rate_limit(socket.assigns.user_id) do

      msg = build_message(payload, socket)

      case Router.route(msg) do
        :delivered ->
          # Destinataire en ligne → livraison directe
          push(socket, "msg:sent_ack", %{id: msg.id, status: "sent"})
          {:noreply, socket}

        :queued ->
          # Destinataire hors ligne → mis en file
          push(socket, "msg:sent_ack", %{id: msg.id, status: "queued"})
          {:noreply, socket}

        {:error, reason} ->
          push(socket, "error", %{code: "send_failed", reason: reason, msg_id: payload["id"]})
          {:noreply, socket}
      end
    else
      {:error, reason} ->
        push(socket, "error", %{code: "validation_failed", reason: reason})
        {:noreply, socket}
    end
  end

  @doc """
  Accusé de lecture - envoyé quand l'utilisateur ouvre la conversation.
  Déclenche l'envoi d'un "msg:read" (2 traits bleus) à l'émetteur original.
  """
  def handle_in("msg:ack_read", %{"msg_id" => msg_id, "from" => from_user_id}, socket) do
    Router.send_read_receipt(msg_id, from_user_id, socket.assigns.user_id)
    {:noreply, socket}
  end

  @doc """
  Heartbeat client - reçu toutes les 30 secondes.
  Met à jour last_seen_at dans le service de présence.
  Répond immédiatement avec un pong pour que le client mesure la latence.
  """
  def handle_in("heartbeat", %{"ts" => client_ts}, socket) do
    PresenceClient.heartbeat(socket.assigns.user_id, socket.assigns.device_id)
    push(socket, "heartbeat_ack", %{server_ts: :os.system_time(:millisecond), client_ts: client_ts})
    {:noreply, socket}
  end

  # ─── Events internes ─────────────────────────────────────────────────────────

  # Livraison des messages en attente à la reconnexion
  def handle_info(:deliver_pending, socket) do
    pending = Queue.pop_all(socket.assigns.user_id)

    Enum.each(pending, fn msg ->
      push(socket, "msg:receive", msg)
      # Notifier l'émetteur que le message a été livré (2 traits gris)
      Router.send_delivery_receipt(msg.id, msg.from, socket.assigns.user_id)
    end)

    if length(pending) > 0 do
      require Logger
      Logger.debug("[UserChannel] #{length(pending)} message(s) livrés à #{socket.assigns.user_id}")
    end

    {:noreply, socket}
  end

  # Réception d'un changement de présence (envoyé par le service Présence via PubSub)
  def handle_info({:presence_change, _org_id, user_id, status, timestamp}, socket) do
    payload = format_presence(user_id, status, timestamp)
    push(socket, "presence:update", payload)
    {:noreply, socket}
  end

  # Livraison d'un message entrant depuis le Router
  def handle_info({:incoming_message, msg}, socket) do
    push(socket, "msg:receive", msg)
    # Envoyer l'accusé de livraison à l'émetteur (2 traits gris)
    Router.send_delivery_receipt(msg.id, msg.from, socket.assigns.user_id)
    {:noreply, socket}
  end

  # ─── Privé ───────────────────────────────────────────────────────────────────

  defp validate_message(%{"id" => id, "to" => to, "ciphertext" => ct})
       when is_binary(id) and is_binary(to) and is_binary(ct) and byte_size(ct) > 0 do
    :ok
  end
  defp validate_message(_), do: {:error, "missing or invalid fields"}

  defp check_rate_limit(user_id) do
    # Max 60 messages par minute par utilisateur
    case Hammer.check_rate("msg:send:#{user_id}", 60_000, 60) do
      {:allow, _} -> :ok
      {:deny, _}  -> {:error, "rate_limit_exceeded"}
    end
  end

  defp build_message(payload, socket) do
    %{
      id:            payload["id"] || Uniq.UUID.uuid7(),
      from:          socket.assigns.user_id,
      org_id:        socket.assigns.org_id,
      to:            payload["to"],
      ciphertext:    payload["ciphertext"],
      sender_key_id: payload["sender_key_id"],
      type:          payload["type"] || "text",
      timestamp:     payload["timestamp"] || :os.system_time(:millisecond),
      server_ts:     :os.system_time(:millisecond)
    }
  end

  defp format_presence(user_id, :online, timestamp) do
    %{user_id: user_id, status: "online", timestamp: timestamp}
  end
  defp format_presence(user_id, {:offline, last_seen}, _timestamp) do
    diff = DateTime.diff(DateTime.utc_now(), last_seen, :second)
    label = cond do
      diff < 60    -> "en ligne il y a moins d'une minute"
      diff < 3600  -> "en ligne il y a #{div(diff, 60)} min"
      diff < 86400 -> "en ligne il y a #{div(diff, 3600)} h"
      true         -> "en ligne il y a #{div(diff, 86400)} j"
    end
    %{user_id: user_id, status: "offline", last_seen: DateTime.to_iso8601(last_seen), label: label}
  end
end
