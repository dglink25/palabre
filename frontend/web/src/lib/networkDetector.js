/**
 * NetworkDetector - Détection automatique du mode de connexion
 *
 * Architecture :
 *   Le Tenant_Server fait tourner un DNS local (dnsmasq) qui résout
 *   {org}.palabre.com → IP locale (192.168.x.x) sur le réseau interne.
 *   Les appareils configurés avec ce DNS atteignent directement le serveur.
 *
 *   Quand un appareil est hors réseau (hors LAN), la probe vers
 *   {org}.palabre.com échoue (l'IP locale est injoignable).
 *   L'app bascule alors vers le serveur central qui fait le relais.
 *
 * Modes :
 *   direct      : probe vers le Tenant_Server réussit → connexion directe (LAN)
 *   relay       : probe échoue → connexion via le serveur central (Internet)
 *   unavailable : ni tenant ni central ne répondent
 *
 * La tenantUrl contient le FQDN qui résout localement (ex: https://acme.palabre.com).
 * Le DNS local du Tenant_Server le résout en IP LAN.
 * En dehors du réseau, ce même FQDN ne résout pas (ou résout en IP publique
 * inaccessible directement) → la probe échoue → basculement relais.
 */

const PROBE_TIMEOUT_MS  = parseInt(import.meta.env.VITE_PROBE_TIMEOUT_MS  || '3000', 10);
const PROBE_INTERVAL_MS = parseInt(import.meta.env.VITE_PROBE_INTERVAL_MS || '30000', 10);
const SWITCH_DELAY_MS   = 5000;
const BG_THRESHOLD_MS   = 30_000;

// URL du tenant (fournie dynamiquement depuis l'API centrale après connexion)
// Exemple : https://acme.palabre.com
// null si l'utilisateur n'a pas d'organisation ou si le tenant n'est pas configuré
const TENANT_BASE_URL   = import.meta.env.VITE_TENANT_BASE_URL || null;
const RELAY_BASE_URL    = import.meta.env.VITE_RELAY_BASE_URL
                          || import.meta.env.VITE_API_BASE_URL
                          || 'http://localhost:4001/api/v1';

class NetworkDetector {
  constructor() {
    this._mode          = 'direct';   // 'direct' | 'relay' | 'unavailable'
    this._tenantUrl     = TENANT_BASE_URL;
    this._relayUrl      = RELAY_BASE_URL;
    this._listeners     = [];
    this._probeTimer    = null;
    this._suspended     = false;
    this._lastActive    = Date.now();
    this._retryCount    = 0;

    // Écouter la visibilité de la page (arrière-plan / premier plan)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          const awayMs = Date.now() - this._lastActive;
          if (awayMs >= BG_THRESHOLD_MS) {
            this.probe();
          }
        } else {
          this._lastActive = Date.now();
        }
      });
    }
  }

  // ── Configuration dynamique ───────────────────────────────────────────────

  /**
   * Configure les URLs après l'authentification de l'utilisateur.
   * tenantUrl  = FQDN du tenant, ex: https://acme.palabre.com
   *              Résolu en IP locale via le DNS local du Tenant_Server quand on est sur le LAN.
   *              Échoue (ou timeout) quand on est hors LAN → basculement relais.
   * relayUrl   = URL du serveur central, ex: https://api.palabre.app/api/v1
   */
  configure({ tenantUrl, relayUrl }) {
    this._tenantUrl = tenantUrl || null;
    if (relayUrl) this._relayUrl = relayUrl;
    // Re-sonder immédiatement avec la nouvelle configuration
    this.probe();
  }

  // ── Probe ─────────────────────────────────────────────────────────────────

  /**
   * Émet une Connectivity_Probe vers le Tenant_Server.
   *
   * La probe cible le FQDN du tenant ({org}.palabre.com/health).
   * Sur le réseau local :
   *   → Le DNS local (dnsmasq) résout ce nom en IP LAN → réponse rapide → Direct_Mode
   * Hors réseau local :
   *   → Le DNS local est inaccessible → timeout ou résolution IP publique injoignable
   *   → Probe échoue → basculement vers Relay_Mode via le serveur central
   */
  async probe() {
    if (this._suspended || !this._tenantUrl) {
      // Pas de tenant configuré : toujours en mode relay (central)
      if (this._mode !== 'relay') this._setMode('relay');
      return;
    }

    const probeUrl = `${this._tenantUrl}/health`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

      const res = await fetch(probeUrl, {
        method:  'GET',
        signal:  controller.signal,
        cache:   'no-store',
      });
      clearTimeout(timeout);

      if (res.ok) {
        this._retryCount = 0;
        if (this._mode !== 'direct') {
          this._setMode('direct');
          this._stopProbeInterval();
        }
        return;
      }
      // Réponse non-200 → traité comme échec
      throw new Error(`HTTP ${res.status}`);
    } catch {
      // Probe échouée : basculer en relay
      this._retryCount++;
      if (this._mode !== 'relay' && this._mode !== 'unavailable') {
        await this._switchToRelay();
      } else if (this._mode === 'relay') {
        // Déjà en relay, re-probe automatique en cours
      }
    }
  }

  async _switchToRelay() {
    // Tenter la connexion au serveur central (3 tentatives)
    let relayReachable = false;
    for (let i = 0; i < 3; i++) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
        const res = await fetch(`${this._relayUrl.replace('/api/v1', '')}/health`, {
          method: 'GET', signal: controller.signal, cache: 'no-store',
        });
        clearTimeout(t);
        if (res.ok) { relayReachable = true; break; }
      } catch { /* retry */ }
      if (i < 2) await sleep(SWITCH_DELAY_MS / 3);
    }

    if (relayReachable) {
      this._setMode('relay');
      // En Relay_Mode : re-probe le tenant toutes les 30s
      this._startProbeInterval();
    } else {
      this._setMode('unavailable');
      // Réessayer dans 60s
      setTimeout(() => this.probe(), 60_000);
    }
  }

  // ── Intervalles ───────────────────────────────────────────────────────────

  _startProbeInterval() {
    this._stopProbeInterval();
    this._probeTimer = setInterval(() => {
      if (!this._suspended) this.probe();
    }, PROBE_INTERVAL_MS);
  }

  _stopProbeInterval() {
    if (this._probeTimer) {
      clearInterval(this._probeTimer);
      this._probeTimer = null;
    }
  }

  // ── Arrière-plan ──────────────────────────────────────────────────────────

  /** Suspendre les probes (app en arrière-plan) */
  suspend() {
    this._suspended  = true;
    this._lastActive = Date.now();
    this._stopProbeInterval();
  }

  /** Reprendre les probes (app au premier plan) */
  resume() {
    this._suspended = false;
    const awayMs = Date.now() - this._lastActive;
    if (awayMs >= BG_THRESHOLD_MS) {
      this.probe();
    } else if (this._mode === 'relay') {
      this._startProbeInterval();
    }
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  /** Retourne l'URL de base active selon le mode courant. */
  getActiveBaseUrl() {
    if (this._mode === 'direct' && this._tenantUrl) {
      return `${this._tenantUrl}/api/v1`;
    }
    return this._relayUrl;
  }

  getCurrentMode() {
    return this._mode;
  }

  isTenantConfigured() {
    return !!this._tenantUrl;
  }

  // ── Listeners ─────────────────────────────────────────────────────────────

  /**
   * S'abonner aux changements de mode.
   * @returns {() => void} fonction de désabonnement
   */
  onModeChange(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  _setMode(newMode) {
    if (newMode === this._mode) return;
    const prev = this._mode;
    this._mode = newMode;
    console.info(`[NetworkDetector] ${prev} → ${newMode}`);
    this._listeners.forEach(fn => {
      try { fn(newMode, prev); } catch { /* ignore */ }
    });
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Singleton - une seule instance partagée dans toute l'app
export const networkDetector = new NetworkDetector();

// Démarrer la détection initiale après le chargement du module
if (typeof window !== 'undefined') {
  setTimeout(() => networkDetector.probe(), 500);
}
