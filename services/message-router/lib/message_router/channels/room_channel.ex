defmodule MessageRouter.Channels.RoomChannel do
  use Phoenix.Channel

  @moduledoc """
  Channel de groupe — "room:{room_id}".

  Chaque conversation de groupe a son propre channel.
  N'importe quel membre du groupe peut rejoindre (vérifié en base).

  Events entrants :
    "msg:send"      — envoyer un message dans le groupe
    "msg:ack_read"  — signaler la lecture
    "typing:start"  — indicateur "en train d'écrire..."
    "typing:stop"   — fin de saisie

  Events sortants :
    "msg:receive"   — nouveau message dans le groupe
    "msg:read"      — quelqu'un a lu jusqu'à ce message
    "typing"        — quelqu'un est en train d'écrire
    "member:join"   — nouveau membre rejoint
    "member:leave"  — membre quitte
  """

  alias MessageRouter.{Router, Queue, Repo}

  # ─── Jointure ────────────────────────────────────────────────────────────────

  def join("room:" <> room_id, _params, socket) do
    user_id = socket.assigns.user_id
    org_id  = socket.assigns.org_id

    # Vérifier que l'utilisateur est membre de ce groupe
    case Repo.is_room_member?(room_id, user_id, org_id) do
      true ->
        send(self(), {:after_join, room_id})
        {:ok, socket |> Phoenix.Socket.assign(:room_id, room_id)}

      false ->
        {:error, %{reason: "not_a_member"}}
    end
  end

  # ─── Events entrants ─────────────────────────────────────────────────────────

  def handle_in("msg:send", payload, socket) do
    msg = %{
      id:            payload["id"] || Uniq.UUID.uuid7(),
      from:          socket.assigns.user_id,
      org_id:        socket.assigns.org_id,
      to_room:       socket.assigns.room_id,
      ciphertext:    payload["ciphertext"],
      sender_key_id: payload["sender_key_id"],
      type:          payload["type"] || "text",
      timestamp:     payload["timestamp"] || :os.system_time(:millisecond),
      server_ts:     :os.system_time(:millisecond)
    }

    # Persister le message (ciphertext opaque, jamais déchiffré)
    :ok = Repo.persist_message(msg)

    # Broadcaster à tous les membres connectés du groupe
    broadcast!(socket, "msg:receive", msg)

    # Pour les membres hors ligne : enqueue dans leurs files individuelles
    offline_members = Router.get_offline_members(socket.assigns.room_id, socket.assigns.org_id)
    Enum.each(offline_members, fn member_id ->
      Queue.push(member_id, msg)
    end)

    push(socket, "msg:sent_ack", %{id: msg.id, status: "sent"})
    {:noreply, socket}
  end

  def handle_in("msg:ack_read", %{"msg_id" => msg_id}, socket) do
    # Diffuser à tous les membres que cet utilisateur a lu jusqu'ici
    broadcast!(socket, "msg:read", %{
      user_id: socket.assigns.user_id,
      msg_id:  msg_id,
      read_at: :os.system_time(:millisecond)
    })
    {:noreply, socket}
  end

  def handle_in("typing:start", _payload, socket) do
    broadcast_from!(socket, "typing", %{
      user_id: socket.assigns.user_id,
      typing:  true
    })
    {:noreply, socket}
  end

  def handle_in("typing:stop", _payload, socket) do
    broadcast_from!(socket, "typing", %{
      user_id: socket.assigns.user_id,
      typing:  false
    })
    {:noreply, socket}
  end

  # ─── Events internes ─────────────────────────────────────────────────────────

  def handle_info({:after_join, room_id}, socket) do
    # Envoyer l'historique récent (50 derniers messages) au client qui rejoint
    history = Repo.get_room_history(room_id, limit: 50)
    push(socket, "room:history", %{messages: history})

    # Notifier les autres membres
    broadcast_from!(socket, "member:join", %{user_id: socket.assigns.user_id})
    {:noreply, socket}
  end

  def terminate(_reason, socket) do
    broadcast_from!(socket, "member:leave", %{user_id: socket.assigns.user_id})
    :ok
  end
end
