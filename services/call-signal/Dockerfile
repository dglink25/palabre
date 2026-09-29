FROM elixir:1.16-alpine AS builder

RUN apk add --no-cache build-base git

WORKDIR /app
COPY mix.exs mix.lock ./
RUN mix local.hex --force && mix local.rebar --force
RUN MIX_ENV=prod mix deps.get --only prod
RUN MIX_ENV=prod mix deps.compile
COPY config config
COPY lib lib
RUN MIX_ENV=prod mix compile
RUN MIX_ENV=prod mix release

FROM alpine:3.19

RUN apk add --no-cache libstdc++ openssl ncurses-libs

WORKDIR /app
COPY --from=builder /app/_build/prod/rel/call_signal ./

ENV RELEASE_COOKIE=palabre_erlang_cookie

EXPOSE 4040

CMD ["bin/call_signal", "start"]
