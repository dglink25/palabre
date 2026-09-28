defmodule MessageRouter.Repo do
  use Ecto.Repo,
    otp_app: :message_router,
    adapter: Ecto.Adapters.Postgres

  @moduledoc """
  Accès base de données PostgreSQL pour la persistance des messages.

  Les messages sont stockés chiffrés (ciphertext opaque).
  Le serveur ne stocke JAMAIS le contenu en clair.

  Tables attendues (migrées par le backend Node.js) :
    messages        — messages persistés (ciphertext, métadonnées de routage)
    conversations   — conversations 1:1
    rooms           — groupes
    room_members    — membres des groupes
  """

  # ─── Messages ────────────────────────────────────────────────────────────────

  def persist_message(msg) do
    sql = """
    INSERT INTO messages
      (id, from_user_id, to_user_id, to_room_id, org_id,
       ciphertext, sender_key_id, type, status,
       client_ts, server_ts)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, 'sent', $9, $10)
    ON CONFLICT (id) DO NOTHING
    """

    case query(sql, [
      msg.id,
      msg.from,
      Map.get(msg, :to),
      Map.get(msg, :to_room),
      msg.org_id,
      msg.ciphertext,
      Map.get(msg, :sender_key_id),
      msg.type,
      msg.timestamp,
      msg.server_ts
    ]) do
      {:ok, _} -> :ok
      {:error, err} ->
        require Logger
        Logger.error("[Repo] persist_message failed: #{inspect(err)}")
        {:error, err}
    end
  end

  def update_message_status(msg_id, status) do
    status_str = Atom.to_string(status)
    sql = "UPDATE messages SET status = $1, updated_at = now() WHERE id = $2"
    case query(sql, [status_str, msg_id]) do
      {:ok, _} -> :ok
      {:error, err} ->
        require Logger
        Logger.error("[Repo] update_message_status failed: #{inspect(err)}")
        :ok  # best-effort — ne pas bloquer le flux pour un statut
    end
  end

  # ─── Rooms ───────────────────────────────────────────────────────────────────

  def is_room_member?(room_id, user_id, org_id) do
    sql = """
    SELECT 1 FROM room_members
    WHERE room_id = $1 AND user_id = $2 AND org_id = $3 AND status = 'active'
    LIMIT 1
    """
    case query(sql, [room_id, user_id, org_id]) do
      {:ok, %{rows: [_]}} -> true
      _ -> false
    end
  end

  def get_room_members(room_id, org_id) do
    sql = """
    SELECT user_id FROM room_members
    WHERE room_id = $1 AND org_id = $2 AND status = 'active'
    """
    case query(sql, [room_id, org_id]) do
      {:ok, %{rows: rows}} -> Enum.map(rows, fn [uid] -> uid end)
      _ -> []
    end
  end

  def get_room_history(room_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    sql = """
    SELECT id, from_user_id, ciphertext, sender_key_id, type, status,
           client_ts, server_ts
    FROM messages
    WHERE to_room_id = $1
    ORDER BY server_ts DESC
    LIMIT $2
    """
    case query(sql, [room_id, limit]) do
      {:ok, %{columns: cols, rows: rows}} ->
        Enum.map(rows, fn row ->
          cols |> Enum.zip(row) |> Map.new(fn {k, v} -> {String.to_atom(k), v} end)
        end)
        |> Enum.reverse()  # ordre chronologique
      _ -> []
    end
  end
end
