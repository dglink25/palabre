FROM coturn/coturn:4.6.2

# Coturn — serveur STUN/TURN auto-hébergé pour les appels WebRTC Palabre.
#
# STUN : permet aux clients de découvrir leur IP publique et de tenter
#        une connexion P2P directe (sans coût de bande passante serveur).
# TURN : relay de secours quand le P2P est impossible (NAT symétrique,
#        firewall strict). Chiffré DTLS — le contenu des appels est
#        SRTP-chiffré E2E, le serveur TURN ne voit que du chiffré.
#
# Configuration : injectée via variables d'environnement au démarrage.

# --chmod=755 évite le RUN chmod qui échoue sur les images rootless
COPY --chmod=755 entrypoint.sh /entrypoint.sh

EXPOSE 3478/tcp 3478/udp
EXPOSE 5349/tcp 5349/udp
# Plage de ports UDP pour les relais media
EXPOSE 49152-65535/udp

ENTRYPOINT ["/entrypoint.sh"]
