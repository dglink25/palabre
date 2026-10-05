/**
 * PalabreSDK - Classe principale du SDK JavaScript Palabre.
 *
 * Permet d'initialiser la connexion au Developer Portal et d'accéder
 * aux modules de communication (chat, appels, vidéo, push).
 *
 * @example
 * const palabre = await PalabreSDK.init('pk_live_...');
 * await palabre.chat.send('user_id', 'Bonjour !');
 */

import { ChatModule } from './modules/ChatModule';
import { CallModule } from './modules/CallModule';
import { VideoModule } from './modules/VideoModule';
import { PushModule } from './modules/PushModule';

const DEFAULT_BASE_URL = 'https://api.palabre.app/api/v1/developer';

/** Configuration white-label d'un projet */
export interface WhiteLabelConfig {
  logoUrl?: string;
  colorPrimary?: string;
  colorSecondary?: string;
  displayName?: string;
}

/** Options d'initialisation du SDK */
export interface PalabreSDKOptions {
  /** URL de l'API Gateway (utilisé pour les tests ou les déploiements custom) */
  baseUrl?: string;
}

/** Erreur levée par le SDK */
export class PalabreError extends Error {
  public readonly code: string;
  public readonly status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'PalabreError';
    this.code = code;
    this.status = status;
  }
}

type EventHandler = (data: unknown) => void;

/**
 * Classe principale du SDK Palabre.
 * Instanciée via la méthode statique `PalabreSDK.init()`.
 */
export class PalabreSDK {
  readonly #publishableKey: string;
  readonly #baseUrl: string;
  #config: WhiteLabelConfig;
  readonly #listeners: Map<string, EventHandler[]> = new Map();

  /** Module de messagerie - envoyer des messages et écouter les messages entrants. */
  public chat!: ChatModule;

  /** Module d'appels audio/vidéo - initier, accepter, rejeter ou terminer des appels. */
  public call!: CallModule;

  /** Module de vidéoconférence - rejoindre une room Jitsi. */
  public video!: VideoModule;

  /** Module de notifications push - enregistrer/désenregistrer un token FCM. */
  public push!: PushModule;

  private constructor(
    publishableKey: string,
    baseUrl: string,
    config: WhiteLabelConfig
  ) {
    this.#publishableKey = publishableKey;
    this.#baseUrl = baseUrl;
    this.#config = config;
  }

  /**
   * Initialise le SDK avec une Publishable Key.
   *
   * Valide la clé, récupère la White Label Config du projet, puis retourne
   * une instance SDK prête à l'emploi.
   *
   * @param publishableKey - Clé publishable du projet (doit commencer par `pk_live_`)
   * @param options - Options facultatives
   * @returns Instance SDK initialisée
   * @throws {PalabreError} code `INVALID_KEY` si la clé est invalide ou expirée
   *
   * @example
   * const palabre = await PalabreSDK.init('pk_live_abc123...');
   */
  static async init(
    publishableKey: string,
    options: PalabreSDKOptions = {}
  ): Promise<PalabreSDK> {
    if (!publishableKey?.startsWith('pk_live_')) {
      throw new PalabreError(
        'Publishable key invalide. Elle doit commencer par pk_live_.',
        'INVALID_KEY'
      );
    }

    const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

    // Récupération de la White Label Config (valide aussi la clé)
    const config = await PalabreSDK.#fetchWhiteLabelConfig(publishableKey, baseUrl);

    const sdk = new PalabreSDK(publishableKey, baseUrl, config);

    // Initialisation des modules
    sdk.chat = new ChatModule(sdk);
    sdk.call = new CallModule(sdk);
    sdk.video = new VideoModule(sdk);
    sdk.push = new PushModule(sdk);

    return sdk;
  }

  /**
   * Enregistre un listener pour un événement entrant.
   *
   * @param event - Nom de l'événement (`'message'`, `'call'`, `'notification'`)
   * @param handler - Fonction appelée quand l'événement se produit
   *
   * @example
   * palabre.on('message', (msg) => console.log(msg));
   */
  on(event: string, handler: EventHandler): void {
    const handlers = this.#listeners.get(event) ?? [];
    handlers.push(handler);
    this.#listeners.set(event, handlers);
  }

  /**
   * Déclenche les listeners d'un événement (usage interne).
   * @internal
   */
  _emit(event: string, data: unknown): void {
    const handlers = this.#listeners.get(event) ?? [];
    for (const handler of handlers) {
      handler(data);
    }
  }

  /**
   * Effectue une requête HTTP vers l'API Gateway avec la Publishable Key.
   * @internal
   */
  async _request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<unknown> {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Palabre-Key': this.#publishableKey,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let code = 'REQUEST_FAILED';
      let message = 'Erreur API';

      try {
        const err = (await response.json()) as {
          error?: { code?: string; message?: string };
        };
        code = err.error?.code ?? code;
        message = err.error?.message ?? message;
      } catch {
        // pas de JSON dans la réponse
      }

      throw new PalabreError(message, code, response.status);
    }

    return response.json();
  }

  /** Publishable Key du projet (lecture seule) */
  get publishableKey(): string {
    return this.#publishableKey;
  }

  /** URL de base de l'API Gateway (lecture seule) */
  get baseUrl(): string {
    return this.#baseUrl;
  }

  /** Configuration white-label du projet */
  get whiteLabelConfig(): WhiteLabelConfig {
    return this.#config;
  }

  /**
   * Récupère la White Label Config depuis l'API Gateway.
   * @internal
   */
  static async #fetchWhiteLabelConfig(
    publishableKey: string,
    baseUrl: string
  ): Promise<WhiteLabelConfig> {
    const response = await fetch(`${baseUrl}/projects/config`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Palabre-Key': publishableKey,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new PalabreError(
          'Clé publishable invalide ou expirée.',
          'INVALID_KEY',
          401
        );
      }
      throw new PalabreError(
        'Impossible de récupérer la configuration white-label.',
        'CONFIG_FETCH_FAILED',
        response.status
      );
    }

    const data = (await response.json()) as { config: WhiteLabelConfig };
    return data.config ?? {};
  }
}
