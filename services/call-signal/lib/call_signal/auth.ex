defmodule CallSignal.Auth do
  @moduledoc "Vérification JWT - même logique que MessageRouter.Auth."

  @secret Application.compile_env(:call_signal, :jwt_secret, "change_me_access_secret")

  def verify_token(token) do
    with [header_b64, payload_b64, sig_b64] <- String.split(token, "."),
         {:ok, payload_json} <- Base.url_decode64(payload_b64, padding: false),
         {:ok, claims} <- Jason.decode(payload_json),
         :ok <- verify_signature(header_b64, payload_b64, sig_b64),
         :ok <- verify_expiry(claims) do
      {:ok, %{
        user_id:    claims["sub"],
        org_id:     claims["org"],
        session_id: claims["sid"]
      }}
    else
      {:error, reason} -> {:error, reason}
      _ -> {:error, :invalid_token}
    end
  end

  defp verify_signature(h, p, sig) do
    expected = :crypto.mac(:hmac, :sha256, @secret, "#{h}.#{p}")
    expected_b64 = Base.url_encode64(expected, padding: false)
    if Plug.Crypto.secure_compare(expected_b64, sig), do: :ok, else: {:error, :invalid_signature}
  end

  defp verify_expiry(%{"exp" => exp}) when is_integer(exp) do
    if exp > System.system_time(:second), do: :ok, else: {:error, :token_expired}
  end
  defp verify_expiry(_), do: {:error, :missing_exp}
end
