defmodule CallSignal.Channels.DirectCallChannel do
  use Phoenix.Channel

  @moduledoc """
  Signaling pour les appels directs 1:1.

  Cycle de vie d'un appel :
    Alice                 Serveur              Bob
      │── call:invite ──▶│                      │
      │                  │──▶ call:incoming ────│
      │                  │◀── call:accept ──────│ ou call:reject
      │◀── call:accepted ─────────────────────  │
      │── sdp:offer ────▶│                      │
      │                  │──▶ sdp:offer ────────│
      │                  │◀── sdp:answer ───────│
      │◀── sdp:answer ───│                      │
      │── ice:candidate ─▶│──▶ ice:candidate ──│ (échange ICE)
      │                  │                      │
      │ [Appel P2P établi via STUN/TURN — UDP/SRTP]
      │                  │                      │
      │── call:end ─────▶│──▶ call:ended ──────│
      │◀── call:ended ───│                      │

  Events entrants :
    call:invite      — initier un appel
    call:accept      — accepter
    call:reject      — refuser
    call:end         — raccrocher
    sdp:offer        — envoyer l'offre SDP
    sdp:answer       — envoyer la réponse SDP
    ice:candidate    — envoyer un candidat ICE
    call:busy        — signaler occupé

  Events sortants :
    call:incoming    — appel entrant
    call:accepted    — appel accepté par le destinataire
    call:rejected    — appel refusé
    call:ended       — appel terminé (par l'un ou l'autre)
    call:busy        — destinataire occupé
    call:missed      — appel manqué (timeout)
    sdp:offer        — offre SDP transmise
    sdp:answer       — réponse SDP transmise
    ice:candidate    — candidat ICE transmis
    error            — erreur
  """

  alias CallSignal.{CallRegistry, PubSubHelper}

  # Timeout sonnerie : 45 secondes sans réponse = appel manqué
  @ring_timeout_ms 45_000

  def join("call:direct", _params, socket) do
    # S'abonner aux appels entrants pour cet utilisateur
    Phoenix.PubSub.subscribe(CallSignal.PubSub, "user_calls:#{socket.assigns.user_id}")
    {:ok, socket}
  end

  # ── Initier un appel ────────────────────────────────────────────────────────

  def handle_in("call:invite", %{"to" => callee_id, "type" => call_type}, socket) do
    caller_id = socket.assigns.user_id
    org_id    = socket.assigns.org_id

    # Vérifier que le destinataire existe dans l'org (best effort)
    call_id = Uniq.UUID.uuid7()

    call = %CallSignal.CallRegistry{
      id:          call_id,
      org_id:      org_id,
      caller_id:   caller_id,
      callee_id:   callee_id,
      type:        String.to_atom(call_type),
      scope:       :direct,
      status:      :ringing,
      started_at:  DateTime.utc_now()
    }

    CallRegistry.create(call)

    # Notifier le destinataire via le PubSub du message-router
    PubSubHelper.notify_user(callee_id, "call:incoming", %{
      call_id:   call_id,
      from:      caller_id,
      call_type: call_type,
      org_id:    org_id
    })

    # Timer : si pas de réponse dans @ring_timeout_ms → appel manqué
    Process.send_after(self(), {:ring_timeout, call_id, callee_id}, @ring_timeout_ms)

    push(socket, "call:ringing", %{call_id: call_id, to: callee_id})
    {:noreply, assign(socket, :active_call_id, call_id)}
  end

  # ── Accepter un appel ───────────────────────────────────────────────────────

  def handle_in("call:accept", %{"call_id" => call_id}, socket) do
    case CallRegistry.get(call_id) do
      {:ok, call} when call.status == :ringing ->
        now = DateTime.utc_now()
        updated = %{call | status: :active, answered_at: now}
        CallRegistry.update(updated)

        # Notifier l'initiateur que l'appel est accepté
        PubSubHelper.notify_user(call.caller_id, "call:accepted", %{
          call_id:   call_id,
          by:        socket.assigns.user_id,
          answered_at: DateTime.to_iso8601(now)
        })

        push(socket, "call:accepted", %{call_id: call_id})
        {:noreply, assign(socket, :active_call_id, call_id)}

      {:ok, _} ->
        push(socket, "error", %{code: "CALL_NOT_RINGING", call_id: call_id})
        {:noreply, socket}

      :not_found ->
        push(socket, "error", %{code: "CALL_NOT_FOUND", call_id: call_id})
        {:noreply, socket}
    end
  end

  # ── Rejeter un appel ────────────────────────────────────────────────────────

  def handle_in("call:reject", %{"call_id" => call_id}, socket) do
    case CallRegistry.get(call_id) do
      {:ok, call} ->
        updated = %{call | status: :rejected, ended_at: DateTime.utc_now()}
        CallRegistry.update(updated)

        PubSubHelper.notify_user(call.caller_id, "call:rejected", %{
          call_id: call_id,
          by:      socket.assigns.user_id
        })

        {:noreply, socket}

      :not_found ->
        {:noreply, socket}
    end
  end

  # ── Raccrocher ──────────────────────────────────────────────────────────────

  def handle_in("call:end", %{"call_id" => call_id}, socket) do
    terminate_call(call_id, socket.assigns.user_id, :ended)
    {:noreply, assign(socket, :active_call_id, nil)}
  end

  # ── Signaling SDP/ICE (relayés tels quels entre les pairs) ──────────────────

  def handle_in("sdp:offer", %{"call_id" => call_id, "sdp" => sdp}, socket) do
    case CallRegistry.get(call_id) do
      {:ok, call} ->
        target = if call.caller_id == socket.assigns.user_id, do: call.callee_id, else: call.caller_id
        PubSubHelper.notify_user(target, "sdp:offer", %{
          call_id: call_id,
          from:    socket.assigns.user_id,
          sdp:     sdp
        })
        {:noreply, socket}
      :not_found ->
        push(socket, "error", %{code: "CALL_NOT_FOUND"})
        {:noreply, socket}
    end
  end

  def handle_in("sdp:answer", %{"call_id" => call_id, "sdp" => sdp}, socket) do
    case CallRegistry.get(call_id) do
      {:ok, call} ->
        target = if call.caller_id == socket.assigns.user_id, do: call.callee_id, else: call.caller_id
        PubSubHelper.notify_user(target, "sdp:answer", %{
          call_id: call_id,
          from:    socket.assigns.user_id,
          sdp:     sdp
        })
        {:noreply, socket}
      :not_found ->
        push(socket, "error", %{code: "CALL_NOT_FOUND"})
        {:noreply, socket}
    end
  end

  def handle_in("ice:candidate", %{"call_id" => call_id, "candidate" => candidate}, socket) do
    case CallRegistry.get(call_id) do
      {:ok, call} ->
        target = if call.caller_id == socket.assigns.user_id, do: call.callee_id, else: call.caller_id
        PubSubHelper.notify_user(target, "ice:candidate", %{
          call_id:   call_id,
          from:      socket.assigns.user_id,
          candidate: candidate
        })
        {:noreply, socket}
      :not_found ->
        {:noreply, socket}
    end
  end

  # ── Signaler occupé ─────────────────────────────────────────────────────────

  def handle_in("call:busy", %{"call_id" => call_id}, socket) do
    case CallRegistry.get(call_id) do
      {:ok, call} ->
        updated = %{call | status: :ended, ended_at: DateTime.utc_now()}
        CallRegistry.update(updated)
        PubSubHelper.notify_user(call.caller_id, "call:busy", %{call_id: call_id})
        {:noreply, socket}
      :not_found ->
        {:noreply, socket}
    end
  end

  # ── Réception des notifications des autres utilisateurs ─────────────────────

  def handle_info({:call_event, event, payload}, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end

  # Timeout sonnerie — appel manqué
  def handle_info({:ring_timeout, call_id, callee_id}, socket) do
    case CallRegistry.get(call_id) do
      {:ok, %{status: :ringing} = call} ->
        updated = %{call | status: :missed, ended_at: DateTime.utc_now()}
        CallRegistry.update(updated)

        push(socket, "call:missed", %{call_id: call_id, to: callee_id})
        PubSubHelper.notify_user(callee_id, "call:missed", %{call_id: call_id, from: call.caller_id})

      _ -> :ok
    end
    {:noreply, socket}
  end

  def terminate(_reason, socket) do
    # Si l'utilisateur se déconnecte pendant un appel actif → raccrocher
    if call_id = socket.assigns[:active_call_id] do
      terminate_call(call_id, socket.assigns.user_id, :ended)
    end
    :ok
  end

  # ── Privé ────────────────────────────────────────────────────────────────────

  defp terminate_call(call_id, user_id, reason) do
    case CallRegistry.get(call_id) do
      {:ok, call} ->
        now = DateTime.utc_now()
        duration = if call.answered_at, do: DateTime.diff(now, call.answered_at, :second), else: 0

        updated = %{call | status: reason, ended_at: now}
        CallRegistry.update(updated)

        target = if call.caller_id == user_id, do: call.callee_id, else: call.caller_id
        PubSubHelper.notify_user(target, "call:ended", %{
          call_id:  call_id,
          ended_by: user_id,
          duration: duration
        })

      :not_found -> :ok
    end
  end
end
