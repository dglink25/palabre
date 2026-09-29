defmodule Presence.Mnesia.Setup do
  @moduledoc """
  Initialise les tables Mnesia au démarrage.

  Table `presence_records` :
    - user_id        : identifiant unique de l'utilisateur (string UUID)
    - org_id         : identifiant de l'organisation (multi-tenant)
    - device_id      : identifiant de l'appareil (un user peut avoir N appareils)
    - socket_pid     : PID du processus WebSocket actif (nil si hors ligne)
    - status         : :online | :offline
    - connected_at   : DateTime de la dernière connexion
    - last_seen_at   : DateTime du dernier heartbeat reçu
    - platform       : "web" | "android" | "ios"

  Stockage :
    - disc_copies = persisté sur disque + répliqué en mémoire
    - Survit aux redémarrages du service
  """
  use GenServer

  require Logger
  require Record

  @table :presence_records

  # Record Erlang natif — accès O(1) depuis n'importe quel processus du noeud
  Record.defrecord(:presence_record, [
    :user_id,
    :org_id,
    :device_id,
    :socket_pid,
    :status,
    :connected_at,
    :last_seen_at,
    :platform
  ])

  def start_link(_), do: GenServer.start_link(__MODULE__, [], name: __MODULE__)

  @impl true
  def init(_) do
    {:ok, []}
  end

  @doc """
  Appelé au démarrage de l'application AVANT le superviseur.
  Crée le schéma Mnesia et les tables si elles n'existent pas.
  """
  def ensure_schema do
    case :mnesia.create_schema([node()]) do
      :ok -> :ok
      {:error, {_, {:already_exists, _}}} -> :ok
      err -> raise "Mnesia schema creation failed: #{inspect(err)}"
    end

    :mnesia.start()

    case :mnesia.create_table(@table,
           attributes: [
             :user_id,
             :org_id,
             :device_id,
             :socket_pid,
             :status,
             :connected_at,
             :last_seen_at,
             :platform
           ],
           disc_copies: [node()],
           # Index secondaire sur org_id pour lister tous les membres d'une org
           index: [:org_id, :status],
           type: :set
         ) do
      {:atomic, :ok} ->
        Logger.info("[Mnesia] Table #{@table} créée")
        :ok

      {:aborted, {:already_exists, @table}} ->
        Logger.info("[Mnesia] Table #{@table} déjà existante")
        :ok

      err ->
        raise "Mnesia table creation failed: #{inspect(err)}"
    end
  end
end
