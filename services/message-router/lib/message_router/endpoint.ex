defmodule MessageRouter.Endpoint do
  use Phoenix.Endpoint, otp_app: :message_router

  # WebSocket — point d'entrée unique pour web et mobile
  # ws://host:4020/socket/websocket
  socket "/socket", MessageRouter.UserSocket,
    websocket: [
      timeout: :infinity,       # La connexion ne raccroche JAMAIS côté serveur
      compress: true,           # Compression per-message deflate
      check_origin: false       # Le contrôle d'origine est fait dans UserSocket
    ],
    longpoll: false             # Pas de fallback longpoll — WebSocket only

  plug Plug.RequestId
  plug Plug.Logger

  plug Plug.Parsers,
    parsers: [:urlencoded, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()

  plug MessageRouter.HTTP.Router
end
