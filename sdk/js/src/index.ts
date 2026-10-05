/**
 * palabre-sdk - SDK JavaScript officiel pour l'intégration Palabre.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { PalabreSDK } from 'palabre-sdk';
 *
 * const palabre = await PalabreSDK.init('pk_live_...');
 * await palabre.chat.send('user_id', 'Bonjour !');
 * ```
 */

// ── Classe principale ───────────────────────────────────────────────────────
export { PalabreSDK } from './PalabreSDK';
export type { WhiteLabelConfig, PalabreSDKOptions } from './PalabreSDK';
export { PalabreError } from './PalabreSDK';

// ── Modules ─────────────────────────────────────────────────────────────────
export { ChatModule } from './modules/ChatModule';
export { CallModule } from './modules/CallModule';
export { VideoModule } from './modules/VideoModule';
export { PushModule } from './modules/PushModule';

// ── Utilitaires white-label ──────────────────────────────────────────────────
export {
  fetchConfig,
  applyConfig,
  invalidateConfigCache,
  GENERIC_LOGO_URL,
  startConfigPolling,
  stopConfigPolling,
} from './utils/whiteLabelConfig';

// ── Utilitaires webhook ──────────────────────────────────────────────────────
export { verifyWebhookSignature } from './utils/webhook';
