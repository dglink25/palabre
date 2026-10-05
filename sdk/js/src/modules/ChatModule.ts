import type { PalabreSDK } from '../PalabreSDK';

/**
 * ChatModule - module de messagerie du SDK Palabre.
 *
 * Permet d'envoyer des messages à un utilisateur via l'infrastructure E2E
 * de Palabre, et d'écouter les messages entrants via les événements SDK.
 *
 * @example
 * await palabre.chat.send('user_id_123', 'Bonjour !');
 * palabre.on('message', (msg) => console.log(msg));
 */
export class ChatModule {
  constructor(private readonly sdk: PalabreSDK) {}

  /**
   * Envoie un message à un utilisateur via l'API proxy.
   *
   * @param userId - Identifiant de l'utilisateur destinataire
   * @param message - Contenu du message
   * @returns La réponse de l'API (message créé)
   *
   * @example
   * const result = await palabre.chat.send('user_id_123', 'Bonjour !');
   */
  async send(userId: string, message: string): Promise<unknown> {
    const response = await this.sdk._request('POST', '/proxy/messages', {
      recipientId: userId,
      content: message,
    });

    // Émettre l'événement 'message' pour les listeners enregistrés
    this.sdk._emit('message', response);

    return response;
  }
}
