defmodule CallSignal.Channels.GroupCallChannel do
  use Phoenix.Channel

  @moduledoc """
  Signaling pour les appels de groupe via Mediasoup SFU.

  Architecture appel groupe :
    Chaque participant se connecte au SFU Mediasoup.
    Ce channel gère uniquement le signaling (qui rejoint, qui part,
    échange SDP/ICE avec le SFU). Le media UDP transite directement
    entre les appareils et Mediasoup.

  Flux :
    1. Un membre initie → call:group:start → notifie tous les membres
    2. Chaque membre acceptant → call:group:join
    3. Serveur crée/récupère la room Mediasoup → retourne les paramètres SFU
    4. Chaque membre négocie SDP/ICE avec le SFU (pas entre pairs)
    5. Chaque membre peut quitter → call:group:leave
    6. Dernier membre → appel terminé

  Events entrants :
    call:group:start      - démarrer un appel de groupe
    call:group:join       - rejoindre un appel de groupe en cours
    call:group:leave      - quitter
    sfu:sdp:offer         - offre SDP vers le SFU
    sfu:ice:candidate     - candidat ICE vers le SFU

  Events sortants :
    call:group:started    - appel initié, paramètres SFU inclus
    call:group:participant_joined  - quelqu'un a rejoint
    call:group:participant_left    - quelqu'un a quitté
    call:group:ended      - plus aucun participant
    sfu:sdp:answer        - réponse SDP du SFU
    sfu:ice:candidate     - candidat ICE du SFU
    error
  """

  alias CallSignal.{CallRegistry, PubSubHelper, MediasoupClient}

  def join("call:group:" <> room_id, _params, socket) do
    Phoenix.PubSub.subscribe(CallSignal.PubSub, "group_call:#{room_id}")
    {:ok, assign(socket, :room_id, room_id)}
  end

  # ── Démarrer un appel de groupe ─────────────────────────────────────────────

  def handle_in("call:group:start", %{"type" => call_type}, socket) do
    room_id   = socket.assigns.room_id
    caller_id = socket.assigns.user_id
    org_id    = socket.assigns.org_id
    call_id   = Uniq.UUID.uuid7()

    # Créer ou récupérer la room Mediasoup pour ce groupe
    {:ok, sfu_params} = MediasoupClient.get_or_create_room(room_id, org_id)

    call = %CallSignal.CallRegistry{
      id:          call_id,
      org_id:      org_id,
      caller_id:   caller_id,
      room_id:     room_id,
      type:        String.to_atom(call_type),
      scope:       :group,
      status:      :active,
      sfu_room_id: sfu_params.room_id,
      started_at:  DateTime.utc_now(),
      participants: MapSet.new([caller_id])
    }

    CallRegistry.create(call)

    # Notifier tous les membres du groupe via le message-router PubSub
    PubSubHelper.notify_room(room_id, org_id, "call:group:started", %{
      call_id:    call_id,
      room_id:    room_id,
      started_by: caller_id,
      call_type:  call_type,
      sfu_url:    sfu_params.url
    })

    push(socket, "call:group:started", %{
      call_id:   call_id,
      sfu_url:   sfu_params.url,
      sfu_token: sfu_params.token
    })

    {:noreply, assign(socket, :active_call_id, call_id)}
  end

  # ── Rejoindre un appel de groupe ────────────────────────────────────────────

  def handle_in("call:group:join", %{"call_id" => call_id}, socket) do
    user_id = socket.assigns.user_id
    room_id = socket.assigns.room_id

    case CallRegistry.add_participant(call_id, user_id) do
      {:ok, call} ->
        {:ok, sfu_params} = MediasoupClient.get_or_create_room(room_id, socket.assigns.org_id)

        # Diffuser à tous les participants que quelqu'un a rejoint
        Phoenix.PubSub.broadcast(CallSignal.PubSub, "group_call:#{room_id}",
          {:participant_joined, call_id, user_id})

        push(socket, "call:group:joined", %{
          call_id:       call_id,
          participants:  MapSet.to_list(call.participants),
          sfu_url:       sfu_params.url,
          sfu_token:     sfu_params.token
        })

        {:noreply, assign(socket, :active_call_id, call_id)}

      :not_found ->
        push(socket, "error", %{code: "CALL_NOT_FOUND", call_id: call_id})
        {:noreply, socket}
    end
  end

  # ── Quitter un appel de groupe ──────────────────────────────────────────────

  def handle_in("call:group:leave", %{"call_id" => call_id}, socket) do
    leave_group_call(call_id, socket.assigns.user_id, socket.assigns.room_id)
    {:noreply, assign(socket, :active_call_id, nil)}
  end

  # ── Signaling SFU (SDP/ICE entre client et Mediasoup) ───────────────────────

  def handle_in("sfu:sdp:offer", %{"call_id" => call_id, "sdp" => sdp}, socket) do
    case MediasoupClient.forward_sdp_offer(call_id, socket.assigns.user_id, sdp) do
      {:ok, answer_sdp} ->
        push(socket, "sfu:sdp:answer", %{call_id: call_id, sdp: answer_sdp})
      {:error, reason} ->
        push(socket, "error", %{code: "SFU_ERROR", reason: reason})
    end
    {:noreply, socket}
  end

  def handle_in("sfu:ice:candidate", %{"call_id" => call_id, "candidate" => candidate}, socket) do
    MediasoupClient.forward_ice_candidate(call_id, socket.assigns.user_id, candidate)
    {:noreply, socket}
  end

  # ── Réception PubSub ────────────────────────────────────────────────────────

  def handle_info({:participant_joined, call_id, user_id}, socket) do
    push(socket, "call:group:participant_joined", %{call_id: call_id, user_id: user_id})
    {:noreply, socket}
  end

  def handle_info({:participant_left, call_id, user_id}, socket) do
    push(socket, "call:group:participant_left", %{call_id: call_id, user_id: user_id})
    {:noreply, socket}
  end

  def handle_info({:call_ended, call_id}, socket) do
    push(socket, "call:group:ended", %{call_id: call_id})
    {:noreply, socket}
  end

  def handle_info({:call_event, event, payload}, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end

  def terminate(_reason, socket) do
    if call_id = socket.assigns[:active_call_id] do
      leave_group_call(call_id, socket.assigns.user_id, socket.assigns.room_id)
    end
    :ok
  end

  # ── Privé ────────────────────────────────────────────────────────────────────

  defp leave_group_call(call_id, user_id, room_id) do
    case CallRegistry.remove_participant(call_id, user_id) do
      {:ok, call} ->
        Phoenix.PubSub.broadcast(CallSignal.PubSub, "group_call:#{room_id}",
          {:participant_left, call_id, user_id})

        # Si plus aucun participant → terminer l'appel
        if MapSet.size(call.participants) == 0 do
          updated = %{call | status: :ended, ended_at: DateTime.utc_now()}
          CallRegistry.update(updated)
          Phoenix.PubSub.broadcast(CallSignal.PubSub, "group_call:#{room_id}",
            {:call_ended, call_id})
          MediasoupClient.close_room(call.sfu_room_id)
        end

      :not_found -> :ok
    end
  end
end
