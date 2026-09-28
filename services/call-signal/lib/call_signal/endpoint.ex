defmodule CallSignal.Endpoint do
  use Phoenix.Endpoint, otp_app: :call_signal

  socket "/signal", CallSignal.CallSocket,
    websocket: [
      timeout: :infinity,
      compress: false        # SDP/ICE sont de petits messages texte — pas besoin de compression
    ],
    longpoll: false

  plug Plug.RequestId
  plug Plug.Parsers,
    parsers: [:json],
    json_decoder: Phoenix.json_library()

  plug CallSignal.HTTP.Router
end
