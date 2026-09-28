defmodule MessageRouter.UserSocket do
  use Phoenix.Socket

  @moduledoc """
  Socket Phoenix — une connexion WebSocket par appareil.

  Authentification :
  Le client passe son access_token JWT lors du connect/0.
  On vérifie le token auprès du backend Node.js (ou localement avec la clé publique).
  Si valide, on stocke user_id, org_id, device_id dans les assigns du socket.

  Channels montés dynamiquement à la connexion :
    "user:{user_id}"     — messages directs, notifications personnelles
    "room:{room_id}"     — conversations de groupe
    "presence:{org_id}"  — indicateurs de présence de l'organisation
  """

  channel "user:*",     MessageRouter.Channels.UserChannel
  channel "room:*",     MessageRouter.Channels.RoomChannel
  channel "presence:*", MessageRouter.Channels.PresenceChannel

  @impl true
  def connect(%{"token" => token, "device_id" => device_id, "platform" => platform}, socket, _info) do
    case MessageRouter.Auth.verify_token(token) do
      {:ok, %{user_id: user_id, org_id: org_id}} ->
        socket =
          socket
          |> assign(:user_id, user_id)
          |> assign(:org_id, org_id)
          |> assign(:device_id, device_id)
          |> assign(:platform, platform)

        # Notifier le service de présence
        MessageRouter.PresenceClient.set_online(user_id, org_id, device_id, platform, self())

        {:ok, socket}

      {:error, reason} ->
        require Logger
        Logger.warning("[UserSocket] Connexion refusée: #{inspect(reason)}")
        :error
    end
  end

  def connect(_, _, _), do: :error

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.user_id}:#{socket.assigns.device_id}"

  @impl true
  def handle_close(socket) do
    # Appelé automatiquement quand la connexion se ferme (proprement ou non)
    MessageRouter.PresenceClient.set_offline(
      socket.assigns.user_id,
      socket.assigns.device_id
    )
  end
end
