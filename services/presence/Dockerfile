FROM elixir:1.16-alpine AS builder

RUN apk add --no-cache build-base git

WORKDIR /app
COPY mix.exs ./
RUN mix local.hex --force && mix local.rebar --force

# Téléchargement avec retry automatique en cas de timeout réseau
RUN for i in 1 2 3 4 5; do \
      HEX_HTTP_CONCURRENCY=1 HEX_HTTP_TIMEOUT=180 MIX_ENV=prod mix deps.get --only prod && break || \
      (echo "Tentative $i échouée, nouvelle tentative dans 10s..." && sleep 10); \
    done

RUN MIX_ENV=prod mix deps.compile
COPY config config
COPY lib lib
RUN MIX_ENV=prod mix compile
RUN MIX_ENV=prod mix release

# ── Image finale légère ──────────────────────────────────────────────────────
FROM alpine:3.24

RUN apk add --no-cache libstdc++ openssl ncurses-libs wget

WORKDIR /app
COPY --from=builder /app/_build/prod/rel/presence ./

ENV RELEASE_COOKIE=palabre_erlang_cookie
ENV ERL_AFLAGS="-kernel shell_history enabled"

EXPOSE 4010

CMD ["bin/presence", "start"]
