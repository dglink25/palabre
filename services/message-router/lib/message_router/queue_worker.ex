defmodule MessageRouter.Queue.Worker do
  @moduledoc """
  Worker de livraison des messages en attente.

  Se déclenche sur abonnement PubSub "user_online:{user_id}".
  Quand un utilisateur se connecte, le UserSocket publie cet event,
  ce Worker le reçoit et livre tous les messages en attente.

  C'est un double filet de sécurité : UserChannel envoie aussi
  :deliver_pending via handle_info, mais le Worker couvre le cas où
  le Channel n'est pas encore monté au moment de la connexion.
  """
  use GenServer

  require Logger

  alias MessageRouter.{Queue, Router}
  alias Phoenix.PubSub

  @pubsub MessageRouter.PubSub

  def start_link(_), do: GenServer.start_link(__MODULE__, [], name: __MODULE__)

  @impl true
  def init(_) do
    # S'abonner aux événements de connexion utilisateur
    PubSub.subscribe(@pubsub, "system:user_online")
    {:ok, []}
  end

  @impl true
  def handle_info({:user_online, user_id}, state) do
    pending_count = Queue.count(user_id)

    if pending_count > 0 do
      Logger.info("[QueueWorker] Livraison de #{pending_count} message(s) à #{user_id}")
      messages = Queue.pop_all(user_id)

      Enum.each(messages, fn msg ->
        PubSub.broadcast(@pubsub, "user:#{user_id}", {:incoming_message, msg})
        # Envoyer l'accusé de livraison à l'émetteur
        Router.send_delivery_receipt(msg.id, msg.from, user_id)
      end)
    end

    {:noreply, state}
  end

  def handle_info(_, state), do: {:noreply, state}
end
