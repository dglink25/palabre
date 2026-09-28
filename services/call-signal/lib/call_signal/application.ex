defmodule CallSignal.Application do
  @moduledoc """
  Service de signaling pour les appels audio/vidéo Palabre.

  Responsabilités :
  - Gérer le cycle de vie des appels (invitation, acceptation, rejet, fin)
  - Transmettre les messages SDP (Session Description Protocol) entre pairs
  - Transmettre les candidats ICE (Interactive Connectivity Establishment)
  - Gérer les appels de groupe via Mediasoup SFU
  - Tenir un registre des appels actifs

  Architecture WebRTC :
    Appel 1:1 :
      Alice → [SDP Offer]  → Call Signal → [SDP Offer]  → Bob
      Bob   → [SDP Answer] → Call Signal → [SDP Answer] → Alice
      Alice ↔ [ICE candidates] ↔ Call Signal ↔ [ICE candidates] ↔ Bob
      Alice ↔──────── UDP/SRTP (P2P via STUN/TURN) ────────↔ Bob

    Appel groupe :
      Chaque participant → Call Signal → Mediasoup SFU
      Mediasoup distribue les flux à tous les membres

  Chiffrement :
    - Transport : DTLS-SRTP (obligatoire dans WebRTC, natif)
    - Le signal lui-même (SDP/ICE) n'est pas chiffré E2E
      mais ne contient pas de contenu multimédia

  Architecture interne :
    Application.start
      └── Supervisor
            ├── CallSignal.PubSub          — diffusion interne
            ├── CallSignal.CallRegistry    — registre ETS des appels actifs
            ├── CallSignal.Endpoint        — Phoenix WebSocket (port 4040)
            └── CallSignal.Timeout.Sweeper — expire les appels sans réponse
  """
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Phoenix.PubSub, name: CallSignal.PubSub},
      CallSignal.CallRegistry,
      CallSignal.Endpoint,
      CallSignal.Timeout.Sweeper
    ]

    opts = [strategy: :one_for_one, name: CallSignal.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
