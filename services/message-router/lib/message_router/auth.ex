defmodule MessageRouter.Auth do
  @moduledoc """
  Vérification du JWT émis par le backend Node.js.

  On vérifie la signature avec la clé secrète partagée (HMAC-SHA256).
  Si le projet évolue vers RS256, il suffit de remplacer verify_token/1
  par une vérification avec clé publique (JWKS endpoint du backend).

  Claims attendus :
    sub  : user_id (UUID)
    sid  : session_id
    did  : device_id
    org  : org_id  (ajouté par le backend lors de l'émission du token)
    exp  : expiration (unix timestamp)
  """

  @secret Application.compile_env(:message_router, :jwt_secret, "change_me_access_secret")

  @doc """
  Vérifie le token JWT et retourne les claims extraits.
  Retourne {:ok, %{user_id, org_id, device_id, session_id}} ou {:error, reason}.
  """
  def verify_token(token) do
    with [header_b64, payload_b64, sig_b64] <- String.split(token, "."),
         {:ok, payload_json} <- Base.url_decode64(payload_b64, padding: false),
         {:ok, claims} <- Jason.decode(payload_json),
         :ok <- verify_signature(header_b64, payload_b64, sig_b64),
         :ok <- verify_expiry(claims) do

      {:ok, %{
        user_id:    claims["sub"],
        org_id:     claims["org"],
        device_id:  claims["did"],
        session_id: claims["sid"]
      }}
    else
      {:error, reason} -> {:error, reason}
      _ -> {:error, :invalid_token}
    end
  end

  defp verify_signature(header_b64, payload_b64, sig_b64) do
    message = "#{header_b64}.#{payload_b64}"
    expected = :crypto.mac(:hmac, :sha256, @secret, message)
    expected_b64 = Base.url_encode64(expected, padding: false)

    if Plug.Crypto.secure_compare(expected_b64, sig_b64) do
      :ok
    else
      {:error, :invalid_signature}
    end
  end

  defp verify_expiry(%{"exp" => exp}) when is_integer(exp) do
    now = System.system_time(:second)
    if exp > now, do: :ok, else: {:error, :token_expired}
  end
  defp verify_expiry(_), do: {:error, :missing_exp}
end
