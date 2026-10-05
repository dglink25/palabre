import type { PalabreSDK } from '../PalabreSDK';

/**
 * CallModule - module d'appels audio/vidéo du SDK Palabre.
 *
 * Permet d'initier, accepter, refuser et terminer des appels WebRTC
 * via l'infrastructure d'appels existante de Palabre.
 *
 * @example
 * const call = await palabre.call.start('user_id_123');
 * await palabre.call.end(call.callId);
 */
export class CallModule {
  constructor(private readonly sdk: PalabreSDK) {}

  /**
   * Initie un appel vers un utilisateur.
   *
   * @param userId - Identifiant de l'utilisateur à appeler
   * @returns Les credentials TURN et informations de signalisation
   *
   * @example
   * const call = await palabre.call.start('user_id_123');
   */
  async start(userId: string): Promise<unknown> {
    return this.sdk._request('POST', '/proxy/calls', {
      action: 'start',
      recipientId: userId,
    });
  }

  /**
   * Accepte un appel entrant.
   *
   * @param callId - Identifiant de l'appel à accepter
   * @returns La réponse de l'API
   *
   * @example
   * await palabre.call.accept('call_id_abc');
   */
  async accept(callId: string): Promise<unknown> {
    return this.sdk._request('POST', '/proxy/calls', {
      action: 'accept',
      callId,
    });
  }

  /**
   * Rejette un appel entrant.
   *
   * @param callId - Identifiant de l'appel à rejeter
   * @returns La réponse de l'API
   *
   * @example
   * await palabre.call.reject('call_id_abc');
   */
  async reject(callId: string): Promise<unknown> {
    return this.sdk._request('POST', '/proxy/calls', {
      action: 'reject',
      callId,
    });
  }

  /**
   * Termine un appel en cours.
   *
   * @param callId - Identifiant de l'appel à terminer
   * @returns La réponse de l'API
   *
   * @example
   * await palabre.call.end('call_id_abc');
   */
  async end(callId: string): Promise<unknown> {
    return this.sdk._request('POST', '/proxy/calls', {
      action: 'end',
      callId,
    });
  }
}
