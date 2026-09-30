defmodule MessageRouter.Router do
  @moduledoc """
  Routeur central des messages.

  Décide pour chaque message :
  - Si le destinataire est dans le réseau local ET en ligne → livraison directe
  - Si le destinataire est dans le réseau local ET hors ligne → enqueue Redis
  - Si le destinataire est EXTERNE au réseau local → relai vers l'agent tenant
  - Gère les accusés de livraison et de lecture

  Le contenu (ciphertext) n'est JAMAIS inspecté ici.
  Le Router ne voit que les métadonnées de routage.

  ## Multi-tenant

  Ce message-router tourne soit sur :
  - Le serveur central : gère tous les utilisateurs de toutes les organisations
  - Un tenant local   : gère les utilisateurs d'une seule organisation en local

  Sur un tenant local, si le destinataire n'est pas dans l'org locale,
  le message est relayé vers l'agent tenant qui le transmet au central.
  Si le tunnel est down, le message est mis en file dans l'agent.
  """

  alias MessageRouter.{Queue, Repo, PresenceClient}
  alias Phoenix.PubSub

  @pubsub MessageRouter.PubSub

  # Mode tenant : ORG_ID défini = on est sur un tenant local
  @tenant_org_id System.get_env("ORG_ID")
  @tenant_agent_url System.get_env("TENANT_AGENT_URL", "http://agent:8080")
  @internal_secret System.get_env("INTERNAL_SERVICES_SECRET", "dev_internal_secret")

  # ─── Routage d'un message direct (1:1) ───────────────────────────────────────

  @doc """
  Route un message vers son destinataire.
  Retourne :delivered | :queued | :relayed | {:error, reason}
  """
  def route(msg) do
    # Si on est sur un tenant local, vérifier si le destinataire est local ou externe
    if @tenant_org_id && msg.org_id != @tenant_org_id do
      # Destinataire dans une autre organisation → relayer via l'agent
      relay_to_agent(msg)
    else
      # Routage normal (central ou même org)
      with :ok <- Repo.persist_message(msg) do
        deliver_or_queue(msg)
      end
    end
  end

  defp deliver_or_queue(msg) do
    case PresenceClient.get_status(msg.to) do
      {:ok, :online} ->
        PubSub.broadcast(@pubsub, "user:#{msg.to}", {:incoming_message, msg})
        :delivered

      {:ok, :offline} ->
        Queue.push(msg.to, msg)
        :queued

      {:ok, :unknown} ->
        # Sur un tenant : l'utilisateur pourrait être externe
        if @tenant_org_id do
          relay_to_agent(msg)
        else
          Queue.push(msg.to, msg)
          :queued
        end

      {:error, _} ->
        Queue.push(msg.to, msg)
        :queued
    end
  end

  # ─── Relai vers l'agent tenant (pour les utilisateurs externes) ───────────────

  defp relay_to_agent(msg) do
    require Logger
    case Req.post(
      "#{@tenant_agent_url}/outbound/message",
      json: msg,
      headers: [{"x-internal-secret", @internal_secret}],
      receive_timeout: 8_000
    ) do
      {:ok, %{status: s}} when s in [200, 202] ->
        Logger.debug("[Router] Message #{msg.id} relaye vers l'agent tenant")
        :relayed

      {:ok, %{status: s, body: body}} ->
        Logger.warning("[Router] Agent retourne #{s} pour message #{msg.id}: #{inspect(body)}")
        # Fallback sur la file locale
        Queue.push(msg.to, msg)
        :queued

      {:error, reason} ->
        Logger.warning("[Router] Agent inaccessible (#{inspect(reason)}) — message #{msg.id} mis en file locale")
        Queue.push(msg.to, msg)
        :queued
    end
  end

  # ─── Accusés de réception ────────────────────────────────────────────────────

  @doc """
  Envoie l'accusé de livraison à l'émetteur (2 traits gris).
  Appelé dès que le message est livré à l'appareil du destinataire.
  """
  def send_delivery_receipt(msg_id, from_user_id, delivered_to_user_id) do
    receipt = %{
      type:             "delivery_receipt",
      msg_id:           msg_id,
      delivered_to:     delivered_to_user_id,
      delivered_at:     :os.system_time(:millisecond)
    }
    PubSub.broadcast(@pubsub, "user:#{from_user_id}", {:incoming_message, receipt})
    Repo.update_message_status(msg_id, :delivered)
  end

  @doc """
  Envoie l'accusé de lecture à l'émetteur (2 traits bleus).
  Appelé quand le destinataire ouvre la conversation et envoie msg:ack_read.
  """
  def send_read_receipt(msg_id, from_user_id, read_by_user_id) do
    receipt = %{
      type:       "read_receipt",
      msg_id:     msg_id,
      read_by:    read_by_user_id,
      read_at:    :os.system_time(:millisecond)
    }
    PubSub.broadcast(@pubsub, "user:#{from_user_id}", {:incoming_message, receipt})
    Repo.update_message_status(msg_id, :read)
  end

  # ─── Membres hors ligne d'un groupe ──────────────────────────────────────────

  @doc """
  Retourne la liste des user_ids des membres d'un groupe qui sont hors ligne.
  Utilisé par RoomChannel pour enqueuer les messages pour les absents.
  """
  def get_offline_members(room_id, org_id) do
    all_members = Repo.get_room_members(room_id, org_id)
    online = PresenceClient.get_org_online_ids(org_id)
    all_members -- online
  end
end
