import Config

config :call_signal, CallSignal.Endpoint,
  url:             [host: System.get_env("PUBLIC_HOST", "localhost")],
  http:            [port: String.to_integer(System.get_env("CALL_SIGNAL_PORT", "4040"))],
  server:          true,
  secret_key_base: System.get_env("PHOENIX_SECRET_KEY_BASE",
    "palabre_dev_secret_key_base_change_in_prod_must_be_64_chars_minimum_xxxxx")

config :call_signal,
  jwt_secret:         System.get_env("JWT_ACCESS_SECRET", "change_me_access_secret"),
  mediasoup_url:      System.get_env("MEDIASOUP_URL", "http://mediasoup:3478"),
  message_router_url: System.get_env("MESSAGE_ROUTER_URL", "http://message-router:4020"),
  internal_secret:    System.get_env("INTERNAL_SERVICES_SECRET", "dev_internal_secret"),
  http_port:          String.to_integer(System.get_env("CALL_SIGNAL_PORT", "4040")),
  public_host:        System.get_env("PUBLIC_HOST", "localhost")

System.put_env("RELEASE_COOKIE", System.get_env("RELEASE_COOKIE", "palabre_erlang_cookie"))
