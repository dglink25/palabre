import type { WhiteLabelConfig } from '../PalabreSDK';

/** URL de base par défaut de l'API Gateway */
const DEFAULT_BASE_URL = 'https://api.palabre.app/api/v1/developer';

/** Durée du cache en mémoire (5 minutes en millisecondes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Entrée du cache en mémoire */
interface CacheEntry {
  config: WhiteLabelConfig;
  fetchedAt: number; // timestamp ms
}

/** Cache en mémoire par clé API */
const configCache = new Map<string, CacheEntry>();

/**
 * Récupère la White Label Config depuis l'API Gateway pour une clé API donnée.
 *
 * Le résultat est mis en cache en mémoire pendant 5 minutes afin d'éviter
 * des requêtes répétées lors de chaque initialisation ou rechargement.
 *
 * @param apiKey - Publishable Key du projet (`pk_live_...`)
 * @param baseUrl - URL de base de l'API Gateway (optionnel)
 * @returns La White Label Config du projet
 *
 * @example
 * const config = await fetchConfig('pk_live_abc123');
 */
export async function fetchConfig(
  apiKey: string,
  baseUrl: string = DEFAULT_BASE_URL
): Promise<WhiteLabelConfig> {
  const cacheKey = `${baseUrl}::${apiKey}`;
  const now = Date.now();

  // Vérifier si le cache est encore valide
  const cached = configCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.config;
  }

  // Récupérer la config depuis l'API
  const response = await fetch(`${baseUrl}/projects/config`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Palabre-Key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Impossible de récupérer la White Label Config (HTTP ${response.status})`
    );
  }

  const data = (await response.json()) as { config?: WhiteLabelConfig };
  const config: WhiteLabelConfig = data.config ?? {};

  // Mettre en cache avec le timestamp actuel
  configCache.set(cacheKey, { config, fetchedAt: now });

  return config;
}

/**
 * Vide le cache en mémoire pour une clé API donnée (ou tout le cache).
 *
 * Utile pour forcer un rechargement de la config après une mise à jour.
 *
 * @param apiKey - Clé API à invalider (optionnel - si absent, vide tout le cache)
 * @param baseUrl - URL de base associée à la clé (optionnel)
 */
export function invalidateConfigCache(
  apiKey?: string,
  baseUrl: string = DEFAULT_BASE_URL
): void {
  if (apiKey) {
    configCache.delete(`${baseUrl}::${apiKey}`);
  } else {
    configCache.clear();
  }
}

/**
 * URL du logo générique neutre utilisé en l'absence de logo configuré.
 * Ne contient aucune référence à la marque Palabre.
 */
export const GENERIC_LOGO_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%23e5e7eb' stroke='%23d1d5db' stroke-width='1.5'/%3E%3Cpath d='M14 16h12M14 20h8M14 24h10' stroke='%239ca3af' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E";

/**
 * Applique la White Label Config à un élément conteneur DOM en injectant les
 * variables CSS et en remplaçant les éléments de marque Palabre.
 *
 * Variables CSS injectées :
 * - `--palabre-primary`      : couleur primaire du projet
 * - `--palabre-secondary`    : couleur secondaire du projet
 * - `--palabre-display-name` : nom d'affichage du projet
 *
 * @param config - White Label Config du projet
 * @param containerElement - Élément DOM racine des composants UI à personnaliser
 *
 * @example
 * const container = document.getElementById('chat-widget');
 * applyConfig(config, container);
 */
export function applyConfig(
  config: WhiteLabelConfig,
  containerElement: HTMLElement
): void {
  // ── 1. Injection des variables CSS ──────────────────────────────────────
  if (config.colorPrimary) {
    containerElement.style.setProperty('--palabre-primary', config.colorPrimary);
  }

  if (config.colorSecondary) {
    containerElement.style.setProperty(
      '--palabre-secondary',
      config.colorSecondary
    );
  }

  if (config.displayName) {
    containerElement.style.setProperty(
      '--palabre-display-name',
      `"${config.displayName}"`
    );
  }

  // ── 2. Remplacement du logo ──────────────────────────────────────────────
  const logoUrl = config.logoUrl ?? GENERIC_LOGO_URL;
  const logoElements = Array.from(
    containerElement.querySelectorAll<HTMLImageElement>('[data-palabre-logo]')
  );
  for (const img of logoElements) {
    img.src = logoUrl;
    img.alt = config.displayName ?? '';
  }

  // ── 3. Remplacement des textes "Palabre" par le nom d'affichage ──────────
  if (config.displayName) {
    replacePalabreText(containerElement, config.displayName);
  }
}

/**
 * Parcourt récursivement les nœuds texte d'un élément et remplace toutes
 * les occurrences de "Palabre" (insensible à la casse) par le nom d'affichage.
 *
 * @param element - Élément DOM racine à parcourir
 * @param displayName - Nom de remplacement
 * @internal
 */
function replacePalabreText(element: Element, displayName: string): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

  const textNodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  const palabreRegex = /Palabre/gi;

  for (const textNode of textNodes) {
    if (palabreRegex.test(textNode.nodeValue ?? '')) {
      textNode.nodeValue = (textNode.nodeValue ?? '').replace(
        palabreRegex,
        displayName
      );
    }
    // Réinitialiser lastIndex après chaque test (sécurité pour les regex globaux)
    palabreRegex.lastIndex = 0;
  }
}

// ---------------------------------------------------------------------------
// Polling - re-fetch config toutes les 5 minutes (Requirement 11.5)
// ---------------------------------------------------------------------------

/** Handles de polling actifs par clé API */
const pollingHandles = new Map<string, ReturnType<typeof setInterval>>();

/**
 * Démarre un polling toutes les 5 minutes pour re-fetcher la White_Label_Config
 * et mettre à jour le cache. Appelle `onUpdate` si la config a changé.
 *
 * @param apiKey   - Publishable Key du projet
 * @param onUpdate - Callback appelé avec la nouvelle config si elle change
 * @param baseUrl  - URL de base optionnelle
 */
export function startConfigPolling(
  apiKey: string,
  onUpdate: (config: WhiteLabelConfig) => void,
  baseUrl: string = DEFAULT_BASE_URL
): void {
  // Éviter les doublons
  stopConfigPolling(apiKey, baseUrl);

  const handle = setInterval(async () => {
    try {
      const cacheKey = `${baseUrl}::${apiKey}`;
      // Invalider le cache pour forcer un re-fetch
      configCache.delete(cacheKey);
      const newConfig = await fetchConfig(apiKey, baseUrl);
      onUpdate(newConfig);
    } catch {
      // Erreur réseau transitoire - on réessaie au prochain tick
    }
  }, CACHE_TTL_MS);

  pollingHandles.set(`${baseUrl}::${apiKey}`, handle);
}

/**
 * Arrête le polling pour une clé API donnée.
 */
export function stopConfigPolling(
  apiKey: string,
  baseUrl: string = DEFAULT_BASE_URL
): void {
  const key = `${baseUrl}::${apiKey}`;
  const handle = pollingHandles.get(key);
  if (handle !== undefined) {
    clearInterval(handle);
    pollingHandles.delete(key);
  }
}
