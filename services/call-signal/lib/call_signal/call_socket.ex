defmodule CallSignal.CallSocket do
  use Phoenix.Socket

  @moduledoc """
  Socket WebSocket pour le signaling d'appels.

  Même authentification JWT que le message-router.
  Un socket par appareil - monté sur /signal/websocket.

  Channels :
    "call:direct"          - signaling appels 1:1
    "call:group:{room_id}" - signaling appels de groupe
  """

  channel "call:direct",        CallSignal.Channels.DirectCallChannel
  channel "call:group:*",       CallSignal.Channels.GroupCallChannel

  @impl true
  def connect(%{"token" => token}, socket, _info) do
    case CallSignal.Auth.verify_token(token) do
      {:ok, %{user_id: user_id, org_id: org_id}} ->
        socket =
          socket
          |> assign(:user_id, user_id)
          |> assign(:org_id, org_id)
        {:ok, socket}

      {:error, reason} ->
        require Logger
        Logger.warning("[CallSocket] Connexion refusée: #{inspect(reason)}")
        :error
    end
  end

  def connect(_, _, _), do: :error

  @impl true
  def id(socket), do: "call_socket:#{socket.assigns.user_id}"
end
