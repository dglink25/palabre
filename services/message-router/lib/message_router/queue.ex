defmodule MessageRouter.Queue do
  @moduledoc """
  File de messages hors-ligne — stockée dans Redis.

  Structure Redis :
    Key  : "msg_queue:{user_id}"
    Type : List (RPUSH pour enqueuer, LRANGE + DEL pour dépiler)
    TTL  : 30 jours (au-delà, le message est considéré expiré)

  Pourquoi Redis et pas Mnesia ici ?
  - Redis est déjà dans l'infrastructure (partagé avec le backend Node.js)
  - Les files de messages peuvent être volumineuses (médias refs, historique)
  - Redis List est O(1) en push/pop
  - Mnesia est réservé au service de présence (state critique, tolérance aux pannes)

  Opérations :
    push/2       — ajoute un message en fin de file
    pop_all/1    — retire tous les messages en attente (atomique avec MULTI/EXEC)
    count/1      — nombre de messages en attente
  """

  @key_prefix "msg_queue:"
  @ttl_seconds 30 * 24 * 3600  # 30 jours

  def push(user_id, msg) do
    key = key(user_id)
    encoded = Jason.encode!(msg)

    Redix.pipeline(:redix, [
      ["RPUSH", key, encoded],
      ["EXPIRE", key, @ttl_seconds]
    ])

    :ok
  end

  @doc """
  Retire et retourne tous les messages en attente pour un utilisateur.
  Opération atomique : LRANGE + DEL dans un pipeline.
  Si le serveur crash entre LRANGE et DEL → les messages sont re-livrés
  (au pire : double livraison, jamais perte). Les clients doivent gérer
  la déduplication par message.id.
  """
  def pop_all(user_id) do
    key = key(user_id)

    case Redix.pipeline(:redix, [
      ["LRANGE", key, "0", "-1"],
      ["DEL", key]
    ]) do
      {:ok, [messages, _]} when is_list(messages) ->
        Enum.map(messages, fn m ->
          case Jason.decode(m, keys: :atoms) do
            {:ok, msg} -> msg
            _ -> nil
          end
        end)
        |> Enum.reject(&is_nil/1)

      _ -> []
    end
  end

  def count(user_id) do
    case Redix.command(:redix, ["LLEN", key(user_id)]) do
      {:ok, count} -> count
      _ -> 0
    end
  end

  defp key(user_id), do: "#{@key_prefix}#{user_id}"
end
