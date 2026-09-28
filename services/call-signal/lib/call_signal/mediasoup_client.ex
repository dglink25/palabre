defmodule CallSignal.MediasoupClient do
  @moduledoc """
  Client HTTP vers le service Mediasoup SFU (appels de groupe).

  Mediasoup est un SFU (Selective Forwarding Unit) : chaque participant
  envoie son flux UNE FOIS au SFU, qui le redistribue à tous les autres.
  Contrairement à un MCU, le SFU ne mixe pas les flux — chaque client
  décode N flux entrants.

  API interne Mediasoup (port 3478) :
    POST /rooms                 — créer une room
    GET  /rooms/:roomId         — récupérer les paramètres d'une room
    DELETE /rooms/:roomId       — fermer une room
    POST /rooms/:roomId/offer   — soumettre une offre SDP d'un participant
    POST /rooms/:roomId/ice     — soumettre un candidat ICE
  """

  require Logger

  @mediasoup_url Application.compile_env(
    :call_signal, :mediasoup_url, "http://localhost:3478"
  )
  @internal_secret Application.compile_env(
    :call_signal, :internal_secret, "dev_internal_secret"
  )

  @doc "Crée ou récupère une room Mediasoup pour un groupe."
  def get_or_create_room(room_id, org_id) do
    case Req.post(
      "#{@mediasoup_url}/rooms",
      json: %{room_id: room_id, org_id: org_id},
      headers: internal_headers()
    ) do
      {:ok, %{status: status, body: body}} when status in [200, 201] ->
        {:ok, %{
          room_id: body["roomId"],
          url:     "#{@mediasoup_url}/rooms/#{body["roomId"]}",
          token:   body["token"]
        }}

      err ->
        Logger.error("[MediasoupClient] get_or_create_room failed: #{inspect(err)}")
        {:error, :sfu_unavailable}
    end
  end

  @doc "Transmet une offre SDP d'un participant au SFU. Retourne la réponse SDP."
  def forward_sdp_offer(call_id, user_id, sdp) do
    case CallSignal.CallRegistry.get(call_id) do
      {:ok, call} when not is_nil(call.sfu_room_id) ->
        case Req.post(
          "#{@mediasoup_url}/rooms/#{call.sfu_room_id}/offer",
          json: %{user_id: user_id, sdp: sdp},
          headers: internal_headers()
        ) do
          {:ok, %{status: 200, body: %{"sdp" => answer_sdp}}} ->
            {:ok, answer_sdp}
          err ->
            Logger.error("[MediasoupClient] forward_sdp_offer failed: #{inspect(err)}")
            {:error, :sfu_error}
        end

      _ ->
        {:error, :call_not_found}
    end
  end

  @doc "Transmet un candidat ICE au SFU."
  def forward_ice_candidate(call_id, user_id, candidate) do
    case CallSignal.CallRegistry.get(call_id) do
      {:ok, call} when not is_nil(call.sfu_room_id) ->
        Req.post(
          "#{@mediasoup_url}/rooms/#{call.sfu_room_id}/ice",
          json: %{user_id: user_id, candidate: candidate},
          headers: internal_headers()
        )
        :ok
      _ -> :ok
    end
  end

  @doc "Ferme une room Mediasoup (tous les participants ont quitté)."
  def close_room(sfu_room_id) when not is_nil(sfu_room_id) do
    Req.delete(
      "#{@mediasoup_url}/rooms/#{sfu_room_id}",
      headers: internal_headers()
    )
    :ok
  end
  def close_room(_), do: :ok

  defp internal_headers do
    [{"x-internal-secret", @internal_secret}]
  end
end
