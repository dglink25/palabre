import type { PalabreSDK } from '../PalabreSDK';

/**
 * VideoModule - module de vidéoconférence du SDK Palabre.
 *
 * Permet de rejoindre une room de vidéoconférence Jitsi via
 * l'infrastructure de Palabre.
 *
 * @example
 * const session = await palabre.video.join('room_id_123');
 * // session.token contient le token Jitsi pour rejoindre la room
 */
export class VideoModule {
  constructor(private readonly sdk: PalabreSDK) {}

  /**
   * Rejoint une room de vidéoconférence.
   *
   * @param roomId - Identifiant de la room à rejoindre
   * @returns Le token de session Jitsi et les informations de la room
   *
   * @example
   * const session = await palabre.video.join('room_id_123');
   */
  async join(roomId: string): Promise<unknown> {
    return this.sdk._request('POST', '/proxy/video/rooms', {
      roomId,
    });
  }
}
