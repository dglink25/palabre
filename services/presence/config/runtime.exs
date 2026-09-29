import Config

config :presence,
  http_port:       String.to_integer(System.get_env("PRESENCE_HTTP_PORT", "4010")),
  internal_secret: System.get_env("INTERNAL_SERVICES_SECRET", "dev_internal_secret"),
  http_adapter:    {Bandit, port: String.to_integer(System.get_env("PRESENCE_HTTP_PORT", "4010"))}

System.put_env("RELEASE_COOKIE", System.get_env("RELEASE_COOKIE", "palabre_erlang_cookie"))
