/**
 * DevAuthIllustration.jsx
 *
 * Illustration orientée développeur pour les pages d'authentification.
 * Même style que AuthIllustration de Palabre :
 *   - Nœuds reliés sur fond bleu #1A73E8
 *   - Couleurs exactes de la charte (#34A853, #EA4335, #FBBC05, #FFFFFF)
 *   - Icônes SVG évoquant le monde dev : </>  🔑  webhook  SDK
 *   - Zéro dégradé, aplats uniquement
 *   - Animation CSS subtile (pulse sur le nœud central)
 */
export default function DevAuthIllustration() {
  return (
    <>
      <style>{`
        @keyframes devNodePulse {
          0%, 100% { r: 34; opacity: 1; }
          50%       { r: 38; opacity: 0.85; }
        }
        @keyframes devLineDash {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -24; }
        }
        .dev-node-center { animation: devNodePulse 2.8s ease-in-out infinite; }
        .dev-line-anim   { animation: devLineDash 3s linear infinite; }
      `}</style>

      <svg
        viewBox="0 0 440 440"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', maxWidth: 380, height: 'auto' }}
        aria-hidden="true"
        role="img"
      >
        {/* ── Cercle de fond ── */}
        <circle cx="220" cy="220" r="170" fill="#FFFFFF" fillOpacity="0.06" />
        <circle cx="220" cy="220" r="120" fill="#FFFFFF" fillOpacity="0.04" />

        {/* ── Lignes de connexion (animées, pointillées) ── */}
        <line className="dev-line-anim" x1="220" y1="220" x2="90" y2="120"
          stroke="#FFFFFF" strokeOpacity="0.30" strokeWidth="1.5"
          strokeDasharray="6 4" />
        <line className="dev-line-anim" x1="220" y1="220" x2="358" y2="108"
          stroke="#FFFFFF" strokeOpacity="0.30" strokeWidth="1.5"
          strokeDasharray="6 4" />
        <line className="dev-line-anim" x1="220" y1="220" x2="72" y2="308"
          stroke="#FFFFFF" strokeOpacity="0.30" strokeWidth="1.5"
          strokeDasharray="6 4" />
        <line className="dev-line-anim" x1="220" y1="220" x2="350" y2="330"
          stroke="#FFFFFF" strokeOpacity="0.30" strokeWidth="1.5"
          strokeDasharray="6 4" />
        <line className="dev-line-anim" x1="220" y1="220" x2="220" y2="55"
          stroke="#FFFFFF" strokeOpacity="0.30" strokeWidth="1.5"
          strokeDasharray="6 4" />
        {/* Liaison entre nœuds périphériques */}
        <line x1="90" y1="120" x2="358" y2="108"
          stroke="#FFFFFF" strokeOpacity="0.12" strokeWidth="1" />
        <line x1="72" y1="308" x2="350" y2="330"
          stroke="#FFFFFF" strokeOpacity="0.12" strokeWidth="1" />

        {/* ── Nœud central - SDK / API ── */}
        <circle className="dev-node-center" cx="220" cy="220" r="34" fill="#FFFFFF" />
        <circle cx="220" cy="220" r="14" fill="#1A73E8" />
        {/* Icône </> dans le centre */}
        <text x="220" y="225" textAnchor="middle" fill="#FFFFFF"
          fontSize="11" fontWeight="700" fontFamily="'JetBrains Mono', monospace"
          letterSpacing="-0.5">
          &lt;/&gt;
        </text>

        {/* ── Nœud vert - Messagerie ── */}
        <circle cx="90" cy="120" r="26" fill="#34A853" />
        {/* Icône chat bubble */}
        <path d="M80 113 h20 a3 3 0 013 3 v8 a3 3 0 01-3 3 h-6l-4 4v-4 h-10 a3 3 0 01-3-3 v-8 a3 3 0 013-3z"
          fill="white" fillOpacity="0.9" />

        {/* ── Nœud rouge - Sécurité / Clés ── */}
        <circle cx="358" cy="108" r="22" fill="#EA4335" />
        {/* Icône clé simplifiée */}
        <circle cx="352" cy="104" r="5" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.9" />
        <line x1="356" y1="108" x2="367" y2="119" stroke="white" strokeWidth="2" strokeOpacity="0.9" strokeLinecap="round" />
        <line x1="364" y1="116" x2="361" y2="119" stroke="white" strokeWidth="2" strokeOpacity="0.9" strokeLinecap="round" />
        <line x1="367" y1="119" x2="364" y2="122" stroke="white" strokeWidth="2" strokeOpacity="0.9" strokeLinecap="round" />

        {/* ── Nœud jaune - Webhook / Événements ── */}
        <circle cx="72" cy="308" r="20" fill="#FBBC05" />
        {/* Icône webhook (barres verticales) */}
        <line x1="65" y1="315" x2="65" y2="303" stroke="#202124" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="72" y1="317" x2="72" y2="299" stroke="#202124" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="79" y1="315" x2="79" y2="307" stroke="#202124" strokeWidth="2.5" strokeLinecap="round" />

        {/* ── Nœud bleu foncé - SDK Mobile / Flutter ── */}
        <circle cx="350" cy="330" r="24" fill="#1557b0" />
        {/* Icône téléphone simplifié */}
        <rect x="341" y="320" width="18" height="22" rx="3"
          fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.9" />
        <circle cx="350" cy="337" r="2" fill="white" fillOpacity="0.9" />

        {/* ── Nœud blanc - Statistiques ── */}
        <circle cx="220" cy="55" r="15" fill="#FFFFFF" fillOpacity="0.75" />
        {/* Icône graphe en barres */}
        <line x1="213" y1="61" x2="213" y2="52" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" />
        <line x1="220" y1="61" x2="220" y2="48" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" />
        <line x1="227" y1="61" x2="227" y2="55" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" />

        {/* ── Labels de nœuds ── */}
        <text x="90" y="155" textAnchor="middle" fill="white" fillOpacity="0.65"
          fontSize="11" fontFamily="'Inter', sans-serif" fontWeight="500">
          Messagerie
        </text>
        <text x="368" y="140" textAnchor="middle" fill="white" fillOpacity="0.65"
          fontSize="11" fontFamily="'Inter', sans-serif" fontWeight="500">
          Sécurité
        </text>
        <text x="60" y="340" textAnchor="middle" fill="white" fillOpacity="0.65"
          fontSize="11" fontFamily="'Inter', sans-serif" fontWeight="500">
          Webhooks
        </text>
        <text x="360" y="368" textAnchor="middle" fill="white" fillOpacity="0.65"
          fontSize="11" fontFamily="'Inter', sans-serif" fontWeight="500">
          SDK Mobile
        </text>
        <text x="220" y="33" textAnchor="middle" fill="white" fillOpacity="0.65"
          fontSize="11" fontFamily="'Inter', sans-serif" fontWeight="500">
          Analytics
        </text>
        <text x="220" y="267" textAnchor="middle" fill="white" fillOpacity="0.80"
          fontSize="12" fontFamily="'Inter', sans-serif" fontWeight="600">
          API Platform
        </text>
      </svg>
    </>
  );
}
