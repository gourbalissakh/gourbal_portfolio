#!/usr/bin/env node
// node generate.js  →  génère 13 bannières SVG premium dans ce dossier

const fs   = require('fs');
const path = require('path');

// ── Icônes SVG (paths centrés sur 0,0 — scale via transform) ──────────────
const ICONS = {
  // réseau : nœuds reliés
  network: a => `<g transform="translate(530,88)" opacity="0.22">
    <circle cx="0" cy="0" r="16" fill="none" stroke="${a}" stroke-width="2"/>
    <circle cx="-50" cy="-28" r="10" fill="none" stroke="${a}" stroke-width="1.5"/>
    <circle cx="-50" cy="28"  r="10" fill="none" stroke="${a}" stroke-width="1.5"/>
    <circle cx="48"  cy="-22" r="8"  fill="none" stroke="${a}" stroke-width="1.5"/>
    <circle cx="48"  cy="22"  r="8"  fill="none" stroke="${a}" stroke-width="1.5"/>
    <line x1="-16" y1="-7"  x2="-40" y2="-24" stroke="${a}" stroke-width="1.2"/>
    <line x1="-16" y1="7"   x2="-40" y2="24"  stroke="${a}" stroke-width="1.2"/>
    <line x1="16"  y1="-6"  x2="40"  y2="-19" stroke="${a}" stroke-width="1.2"/>
    <line x1="16"  y1="6"   x2="40"  y2="19"  stroke="${a}" stroke-width="1.2"/>
    <circle cx="0"   cy="0"   r="5" fill="${a}" opacity="0.7"/>
    <circle cx="-50" cy="-28" r="3" fill="${a}" opacity="0.45"/>
    <circle cx="-50" cy="28"  r="3" fill="${a}" opacity="0.45"/>
    <circle cx="48"  cy="-22" r="3" fill="${a}" opacity="0.35"/>
    <circle cx="48"  cy="22"  r="3" fill="${a}" opacity="0.35"/>
  </g>`,

  // bouclier + cadenas
  shield: a => `<g transform="translate(530,88)" opacity="0.2">
    <path d="M0,-55 L40,-33 L40,8 Q40,46 0,62 Q-40,46 -40,8 L-40,-33 Z"
      fill="${a}" fill-opacity="0.06" stroke="${a}" stroke-width="2"/>
    <rect x="-11" y="-10" width="22" height="22" rx="3"
      fill="none" stroke="${a}" stroke-width="2"/>
    <path d="M-6,-10 Q-6,-22 0,-22 Q6,-22 6,-10" fill="none" stroke="${a}" stroke-width="2"/>
    <circle cx="0" cy="4" r="3" fill="${a}" opacity="0.6"/>
  </g>`,

  // fenêtre navigateur
  browser: a => `<g transform="translate(530,88)" opacity="0.2">
    <rect x="-52" y="-46" width="104" height="76" rx="9"
      fill="${a}" fill-opacity="0.05" stroke="${a}" stroke-width="2"/>
    <line x1="-52" y1="-28" x2="52" y2="-28" stroke="${a}" stroke-width="1.5"/>
    <circle cx="-38" cy="-37" r="4" fill="${a}" opacity="0.5"/>
    <circle cx="-25" cy="-37" r="4" fill="${a}" opacity="0.35"/>
    <circle cx="-12" cy="-37" r="4" fill="${a}" opacity="0.25"/>
    <rect x="-5" y="-39" width="44" height="8" rx="4"
      fill="none" stroke="${a}" stroke-width="1" opacity="0.4"/>
    <rect x="-36" y="-18" width="72" height="5" rx="2.5" fill="${a}" opacity="0.22"/>
    <rect x="-36" y="-7"  width="55" height="5" rx="2.5" fill="${a}" opacity="0.16"/>
    <rect x="-36" y="4"   width="64" height="5" rx="2.5" fill="${a}" opacity="0.19"/>
    <rect x="-36" y="15"  width="40" height="5" rx="2.5" fill="${a}" opacity="0.13"/>
  </g>`,

  // téléphone + écran
  phone: a => `<g transform="translate(534,88)" opacity="0.2">
    <rect x="-30" y="-56" width="60" height="98" rx="13"
      fill="${a}" fill-opacity="0.05" stroke="${a}" stroke-width="2"/>
    <rect x="-20" y="-44" width="40" height="62" rx="4" fill="${a}" opacity="0.07"/>
    <circle cx="0" cy="48" r="7" fill="none" stroke="${a}" stroke-width="1.5"/>
    <rect x="-9" y="-52" width="18" height="3" rx="1.5" fill="${a}" opacity="0.45"/>
    <rect x="-18" y="-28" width="36" height="5" rx="2" fill="${a}" opacity="0.25"/>
    <rect x="-18" y="-17" width="26" height="5" rx="2" fill="${a}" opacity="0.18"/>
    <rect x="-18" y="-6"  width="32" height="5" rx="2" fill="${a}" opacity="0.2"/>
    <rect x="-18" y="5"   width="20" height="5" rx="2" fill="${a}" opacity="0.14"/>
  </g>`,

  // calques / Docker
  layers: a => `<g transform="translate(530,88)" opacity="0.2">
    <path d="M0,-52 L48,-26 L0,0 L-48,-26 Z"
      fill="${a}" fill-opacity="0.08" stroke="${a}" stroke-width="2"/>
    <path d="M-48,-10 L0,16 L48,-10" fill="none" stroke="${a}" stroke-width="1.8" opacity="0.75"/>
    <path d="M-48,6"  fill="none"/>
    <path d="M-48,6 L0,32 L48,6"   fill="none" stroke="${a}" stroke-width="1.5" opacity="0.5"/>
    <path d="M-48,22 L0,48 L48,22" fill="none" stroke="${a}" stroke-width="1.2" opacity="0.3"/>
    <circle cx="0" cy="-26" r="6" fill="${a}" opacity="0.55"/>
  </g>`,

  // puce / IoT
  chip: a => `<g transform="translate(530,88)" opacity="0.18">
    <rect x="-34" y="-34" width="68" height="68" rx="7"
      fill="${a}" fill-opacity="0.06" stroke="${a}" stroke-width="2"/>
    <rect x="-20" y="-20" width="40" height="40" rx="4"
      fill="none" stroke="${a}" stroke-width="1.2"/>
    ${[-22,-11,0,11,22].map(v => `
    <line x1="-34" y1="${v}" x2="-46" y2="${v}" stroke="${a}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="34"  y1="${v}" x2="46"  y2="${v}" stroke="${a}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="${v}" y1="-34" x2="${v}" y2="-46" stroke="${a}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="${v}" y1="34"  x2="${v}" y2="46"  stroke="${a}" stroke-width="1.5" stroke-linecap="round"/>
    `).join('')}
    <rect x="-7" y="-7" width="14" height="14" rx="3" fill="${a}" opacity="0.35"/>
  </g>`,

  // robot / IA
  robot: a => `<g transform="translate(530,88)" opacity="0.18">
    <line x1="0" y1="-62" x2="0" y2="-50" stroke="${a}" stroke-width="1.8"/>
    <circle cx="0" cy="-66" r="5" fill="none" stroke="${a}" stroke-width="1.5"/>
    <rect x="-30" y="-50" width="60" height="46" rx="10"
      fill="${a}" fill-opacity="0.06" stroke="${a}" stroke-width="2"/>
    <circle cx="-13" cy="-30" r="9" fill="none" stroke="${a}" stroke-width="1.5"/>
    <circle cx="13"  cy="-30" r="9" fill="none" stroke="${a}" stroke-width="1.5"/>
    <circle cx="-13" cy="-30" r="4" fill="${a}" opacity="0.55"/>
    <circle cx="13"  cy="-30" r="4" fill="${a}" opacity="0.55"/>
    <rect x="-17" y="-12" width="34" height="6" rx="3" fill="${a}" opacity="0.3"/>
    <rect x="-26" y="0"   width="52" height="36" rx="7"
      fill="${a}" fill-opacity="0.05" stroke="${a}" stroke-width="1.5"/>
    <rect x="-12" y="8"   width="24" height="14" rx="4" fill="${a}" opacity="0.18"/>
    <line x1="-26" y1="18" x2="-38" y2="18" stroke="${a}" stroke-width="1.5"/>
    <line x1="26"  y1="18" x2="38"  y2="18" stroke="${a}" stroke-width="1.5"/>
  </g>`,

  // fourchette + couteau
  cutlery: a => `<g transform="translate(530,88)" opacity="0.2">
    <line x1="-22" y1="-55" x2="-22" y2="55" stroke="${a}" stroke-width="3" stroke-linecap="round"/>
    <line x1="-30" y1="-55" x2="-30" y2="-22" stroke="${a}" stroke-width="2" stroke-linecap="round"/>
    <line x1="-14" y1="-55" x2="-14" y2="-22" stroke="${a}" stroke-width="2" stroke-linecap="round"/>
    <path d="M-30,-22 Q-22,-10 -14,-22" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/>
    <line x1="22" y1="-55" x2="22" y2="55" stroke="${a}" stroke-width="3" stroke-linecap="round"/>
    <path d="M22,-55 Q40,-30 22,2" fill="${a}" fill-opacity="0.15" stroke="${a}" stroke-width="1.5"/>
  </g>`,

  // clé + roue dentée
  wrench: a => `<g transform="translate(530,88)" opacity="0.18">
    <path d="M-8,-52 Q-26,-46 -26,-28 Q-26,-16 -14,-8 L32,38 Q38,46 30,54 Q22,60 14,52 L-32,6 Q-46,-4 -44,-20 Q-40,-40 -22,-48 Z"
      fill="${a}" fill-opacity="0.08" stroke="${a}" stroke-width="2"/>
    <circle cx="-26" cy="-30" r="12" fill="none" stroke="${a}" stroke-width="1.5"/>
    <circle cx="-26" cy="-30" r="5"  fill="${a}" opacity="0.4"/>
    <circle cx="24"  cy="46"  r="9"  fill="${a}" fill-opacity="0.12" stroke="${a}" stroke-width="1.5"/>
  </g>`,

  // slash < / >
  code: a => `<g transform="translate(530,88)" opacity="0.2">
    <path d="M-4,-36 L-42,0 L-4,36"
      fill="none" stroke="${a}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4,-36 L42,0 L4,36"
      fill="none" stroke="${a}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="14" y1="-48" x2="-14" y2="48"
      stroke="${a}" stroke-width="2.5" stroke-linecap="round"/>
  </g>`,

  // wifi signal
  wifi: a => `<g transform="translate(530,88)" opacity="0.2">
    <path d="M-60,-35 Q0,-78 60,-35" fill="none" stroke="${a}" stroke-width="2"   opacity="0.45"/>
    <path d="M-44,-16 Q0,-54 44,-16" fill="none" stroke="${a}" stroke-width="2.2" opacity="0.65"/>
    <path d="M-28,4   Q0,-30 28,4"   fill="none" stroke="${a}" stroke-width="2.5" opacity="0.85"/>
    <path d="M-12,22  Q0,-8  12,22"  fill="none" stroke="${a}" stroke-width="2.8"/>
    <circle cx="0" cy="38" r="8" fill="${a}" opacity="0.7"/>
    <line x1="0" y1="46" x2="0" y2="56" stroke="${a}" stroke-width="2" opacity="0.35"/>
    <line x1="-14" y1="56" x2="14" y2="56" stroke="${a}" stroke-width="2" opacity="0.35"/>
  </g>`,

  // Python logo simplifié
  python: a => `<g transform="translate(530,88)" opacity="0.2">
    <path d="M0,-55 Q-36,-55 -36,-22 L-36,0 Q-36,18 0,18 Q36,18 36,36 L36,55 Q36,72 0,72"
      fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="-22" cy="-38" r="7" fill="${a}" opacity="0.45"/>
    <circle cx="22"  cy="52"  r="7" fill="${a}" opacity="0.45"/>
  </g>`,
};

// ── Pattern de fond : grille de points ────────────────────────────────────
function dotGrid(accent, xStart = 0) {
  let s = `<g opacity="0.07">`;
  for (let x = xStart + 16; x < 660; x += 28) {
    for (let y = 14; y < 175; y += 28) {
      s += `<circle cx="${x}" cy="${y}" r="1.5" fill="${accent}"/>`;
    }
  }
  return s + `</g>`;
}

// ── Lueur radiale derrière l'icône ────────────────────────────────────────
function glow(cx, cy, r, color) {
  return `<radialGradient id="gl" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">
    <stop offset="0%"   stop-color="${color}" stop-opacity="0.18"/>
    <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
  </radialGradient>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gl)"/>`;
}

// ── Pills tech stack ──────────────────────────────────────────────────────
function pills(techs, accent) {
  let x = 36, y = 148;
  let out = '';
  techs.slice(0, 4).forEach(t => {
    const w = t.length * 6.8 + 16;
    out += `<rect x="${x}" y="${y}" width="${w}" height="18" rx="9"
      fill="${accent}" fill-opacity="0.1" stroke="${accent}" stroke-width="0.8" stroke-opacity="0.4"/>
    <text x="${x + w/2}" y="${y + 12.5}"
      font-family="'Space Mono',monospace,system-ui" font-size="9.5" font-weight="700"
      fill="${accent}" opacity="0.75" text-anchor="middle">${t}</text>`;
    x += w + 7;
  });
  return out;
}

// ── Données projets ───────────────────────────────────────────────────────
const banners = [
  {
    id: 'analyse-reseau',
    cat: 'RÉSEAU',
    title: 'Analyse Réseau',
    tech: ['Wireshark', 'Packet Tracer', 'Linux'],
    from: '#030d1c', to: '#0a2040',
    accent: '#64c8ff',
    icon: 'network',
  },
  {
    id: 'hacking-ethique',
    cat: 'SÉCURITÉ',
    title: 'Hacking Éthique',
    tech: ['Kali Linux', 'Metasploit', 'Nmap', 'Hydra'],
    from: '#140405', to: '#320a0a',
    accent: '#ff6b6b',
    icon: 'shield',
  },
  {
    id: 'systeme-qcm',
    cat: 'WEB',
    title: 'Système de QCM',
    tech: ['PHP', 'MySQL', 'JavaScript', 'Bootstrap'],
    from: '#041408', to: '#0a2e12',
    accent: '#7efff5',
    icon: 'browser',
  },
  {
    id: 'blog-estm',
    cat: 'WEB',
    title: 'Blog ESTM',
    tech: ['PHP', 'MySQL', 'Bootstrap 5'],
    from: '#05091e', to: '#0e1840',
    accent: '#bf96ff',
    icon: 'code',
  },
  {
    id: 'gestion-restaurant',
    cat: 'DESKTOP',
    title: 'Gestion Restaurant',
    tech: ['C#', 'SQL Server', '.NET'],
    from: '#1a1000', to: '#3a2500',
    accent: '#ffd166',
    icon: 'cutlery',
  },
  {
    id: 'gestion-reparations',
    cat: 'WEB',
    title: 'Gestion Réparations',
    tech: ['PHP', 'MySQL', 'Merise'],
    from: '#0e0e0e', to: '#1e1e1e',
    accent: '#94a3b8',
    icon: 'wrench',
  },
  {
    id: 'poubelle-intelligente',
    cat: 'IoT',
    title: 'Poubelle Intelligente',
    tech: ['Arduino', 'C', 'HC-SR04'],
    from: '#031203', to: '#0a2a08',
    accent: '#22d35e',
    icon: 'chip',
  },
  {
    id: 'dhcp-reseau',
    cat: 'RÉSEAU',
    title: 'Projet DHCP',
    tech: ['Linux', 'DHCP', 'Wireshark'],
    from: '#030d1c', to: '#0d2540',
    accent: '#64c8ff',
    icon: 'wifi',
  },
  {
    id: 'python-gui',
    cat: 'DESKTOP',
    title: 'Python GUI',
    tech: ['Python', 'Tkinter'],
    from: '#131206', to: '#28260a',
    accent: '#ffd166',
    icon: 'python',
  },
  {
    id: 'qcm-ia',
    cat: 'FULL STACK · IA',
    title: 'QCM avec IA',
    tech: ['React', 'Laravel', 'REST API'],
    from: '#080518', to: '#180a38',
    accent: '#bf96ff',
    icon: 'robot',
    featured: true,
  },
  {
    id: 'clone-tiktok',
    cat: 'MOBILE',
    title: 'Clone TikTok',
    tech: ['Flutter', 'Dart'],
    from: '#14041a', to: '#2e0a3e',
    accent: '#e879f9',
    icon: 'phone',
  },
  {
    id: 'gestion-hotels',
    cat: 'MOBILE',
    title: 'Gestion Hôtels',
    tech: ['Flutter', 'Dart'],
    from: '#030d1a', to: '#0a2238',
    accent: '#64c8ff',
    icon: 'phone',
  },
  {
    id: 'docker-multi',
    cat: 'DEVOPS',
    title: 'Docker Multi-Services',
    tech: ['Docker', 'PHP', 'MySQL', 'Nginx'],
    from: '#03101a', to: '#082540',
    accent: '#2496ed',
    icon: 'layers',
  },
];

// ── Génération ────────────────────────────────────────────────────────────
banners.forEach(b => {
  const gId = 'bg' + b.id.replace(/-/g, '');
  const decoFn = ICONS[b.icon] || ICONS.code;

  const featuredBadge = b.featured ? `
    <rect x="36" y="122" width="96" height="20" rx="10"
      fill="${b.accent}" fill-opacity="0.15" stroke="${b.accent}" stroke-width="0.8" stroke-opacity="0.5"/>
    <text x="84" y="135.5"
      font-family="'Space Mono',monospace" font-size="9" font-weight="700"
      fill="${b.accent}" opacity="0.85" text-anchor="middle">★ FEATURED</text>` : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="175" viewBox="0 0 660 175">
  <defs>
    <linearGradient id="${gId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="${b.from}"/>
      <stop offset="100%" stop-color="${b.to}"/>
    </linearGradient>
  </defs>

  <!-- fond dégradé -->
  <rect width="660" height="175" fill="url(#${gId})"/>

  <!-- grille de points (droite uniquement) -->
  ${dotGrid(b.accent, 280)}

  <!-- lueur derrière l'icône -->
  ${glow(530, 88, 110, b.accent)}

  <!-- icône décorative -->
  ${decoFn(b.accent)}

  <!-- séparateur vertical -->
  <line x1="420" y1="20" x2="420" y2="155"
    stroke="${b.accent}" stroke-width="0.6" stroke-opacity="0.15"/>

  <!-- bande accent gauche -->
  <rect x="0" y="0" width="4" height="175" fill="${b.accent}" opacity="0.75"/>

  <!-- ligne top accent -->
  <line x1="4" y1="0.8" x2="420" y2="0.8"
    stroke="${b.accent}" stroke-width="1.2" opacity="0.3"/>

  <!-- catégorie -->
  <text x="20" y="35"
    font-family="'Space Mono',monospace,system-ui" font-size="10" font-weight="700"
    fill="${b.accent}" opacity="0.65" letter-spacing="2">${b.cat}</text>

  <!-- titre -->
  <text x="20" y="78"
    font-family="'Space Grotesk',system-ui,sans-serif" font-size="26" font-weight="700"
    fill="white" opacity="0.95" letter-spacing="-0.5">${b.title}</text>

  <!-- ligne sous le titre -->
  <line x1="20" y1="88" x2="${Math.min(b.title.length * 15 + 20, 390)}" y2="88"
    stroke="${b.accent}" stroke-width="1.5" opacity="0.4"/>

  ${b.featured ? featuredBadge : ''}

  <!-- pills tech -->
  ${pills(b.tech, b.accent)}
</svg>`;

  fs.writeFileSync(path.join(__dirname, b.id + '.svg'), svg, 'utf8');
  console.log('✓', b.id + '.svg');
});

console.log(`\nDone — ${banners.length} bannières générées.`);
