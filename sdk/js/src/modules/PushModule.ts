import type { PalabreSDK } from '../PalabreSDK';

/**
 * PushModule - module de notifications push du SDK Palabre.
 *
 * Permet d'enregistrer et de désenregistrer un token FCM pour recevoir
 * des notifications push via l'infrastructure Firebase de Palabre.
 *
 * @example
 * await palabre.push.register('fcm_token_xyz');
 * // Plus tard...
 * await palabre.push.unregister('fcm_token_xyz');
 */
export class PushModule {
  constructor(private readonly sdk: PalabreSDK) {}

  /**
   * Enregistre un token FCM pour les notifications push.
   *
   * @param fcmToken - Token FCM fourni par Firebase Cloud Messaging
   * @returns La réponse de l'API
   *
   * @example
   * await palabre.push.register('your_fcm_token');
   */
  async register(fcmToken: string): Promise<unknown> {
    return this.sdk._request('POST', '/proxy/push', {
      action: 'register',
      fcmToken,
    });
  }

  /**
   * Désenregistre un token FCM pour arrêter les notifications push.
   *
   * @param fcmToken - Token FCM à désenregistrer
   * @returns La réponse de l'API
   *
   * @example
   * await palabre.push.unregister('your_fcm_token');
   */
  async unregister(fcmToken: string): Promise<unknown> {
    return this.sdk._request('POST', '/proxy/push', {
      action: 'unregister',
      fcmToken,
    });
  }
}
