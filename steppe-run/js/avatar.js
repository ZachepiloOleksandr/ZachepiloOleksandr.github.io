// Маркет avatar: a hand-drawn, animated SVG hero that wears whatever the player has bought.
// Every upgrade layer is tagged data-up="<upgrade id>" with data-min (shown from that level on)
// and optional data-max (hidden above it — e.g. sneakers give way to boots). Layers with data-up
// never carry a transform attribute themselves, so CSS pop/ghost effects can't clobber positioning.
import { UPGRADES } from './data.js';

const NS = 'http://www.w3.org/2000/svg';
const INK = '#2b2112';
const UNI = '#6e7d45';          // uniform olive
const GEAR = '#4a5631';         // armour / webbing green
const GEAR_DK = '#3b4527';
const GLOVE = '#8a7650';
const O = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
const o = `stroke="${INK}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"`;
const MIRROR = 'matrix(-1 0 0 1 260 0)'; // the hero is symmetric about x = 130

const up = (id, min, inner, max) => `<g data-up="${id}" data-min="${min}"${max != null ? ` data-max="${max}"` : ''}>${inner}</g>`;
// Camo cloth: flat colour, pixel camo, soft side shading, then the ink outline on top.
const cloth = (d, fill = UNI) =>
  `<path d="${d}" fill="${fill}"/><path d="${d}" fill="url(#avCamo)"/><path d="${d}" fill="url(#avShade)"/><path d="${d}" fill="none" ${O}/>`;
const sleeve = (d) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="21" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${UNI}" stroke-width="16.5" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="url(#avCamo)" stroke-width="16.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const pouch = (x, w = 13) =>
  `<rect x="${x + 3}" y="156" width="${w - 6}" height="8" rx="1" fill="#2d2d2b" ${o}/>` +
  `<rect x="${x}" y="161" width="${w}" height="22" rx="2.5" fill="#56633a" ${o}/>` +
  `<rect x="${x}" y="161" width="${w}" height="8" rx="2.5" fill="#46512d" ${o}/>` +
  `<path d="M${x + 2.5} 177 H${x + w - 2.5}" stroke="#3b4527" stroke-width="1.2"/>`;
const drone = (cls) => `<g class="av-drone ${cls}">
    <ellipse class="av-prop" cx="-17" cy="-8" rx="10" ry="2.3" fill="#dfe8ee" opacity=".55"/>
    <ellipse class="av-prop" cx="17" cy="-8" rx="10" ry="2.3" fill="#dfe8ee" opacity=".55"/>
    <path d="M-17 -5 L17 5 M17 -5 L-17 5" stroke="#1b1c1e" stroke-width="3.4" stroke-linecap="round"/>
    <g fill="#3b3c40" ${o}><rect x="-20" y="-7.5" width="6" height="5" rx="1.5"/><rect x="14" y="-7.5" width="6" height="5" rx="1.5"/>
      <rect x="-20" y="2.5" width="6" height="5" rx="1.5"/><rect x="14" y="2.5" width="6" height="5" rx="1.5"/></g>
    <rect x="-8.5" y="-5.5" width="17" height="11" rx="3.5" fill="#2a2b2e" ${o}/>
    <rect x="-6" y="-4" width="7" height="2.5" rx="1" fill="#e8483c"/>
    <circle cx="2.5" cy="1.5" r="2.8" fill="url(#avLens)" stroke="#111" stroke-width=".8"/>
    <path d="M5 -5 L9 -12.5" stroke="#1b1c1e" stroke-width="1.6" stroke-linecap="round"/>
    <circle class="av-led" cx="9.4" cy="-13" r="1.6" fill="#ff5a3c"/>
    <ellipse class="av-prop" cx="-17" cy="2" rx="10" ry="2.3" fill="#dfe8ee" opacity=".55"/>
    <ellipse class="av-prop" cx="17" cy="2" rx="10" ry="2.3" fill="#dfe8ee" opacity=".55"/>
    PAYLOAD
  </g>`;
const payload = up('fpv', 2, `<g>
    <path d="M-1 5.5 V9" stroke="#1b1c1e" stroke-width="1.4"/>
    <path d="M-4 9 H4 L4.5 17 Q0 22.5 -4.5 17 Z" fill="#56633a" ${o}/>
    <path d="M-4 9 L-6.5 6.5 M4 9 L6.5 6.5" stroke="#1b1c1e" stroke-width="1.4" stroke-linecap="round"/>
    <circle class="av-led" cx="0" cy="13" r="1.3" fill="#ffd23f"/></g>`);

const LEG = 'M102.5 182 L129 182 L128 224 L126 262 L104 262 L102 224 Z';
// Cargo pocket on the outer thigh (mirrored for the other leg).
const POCKET = `<rect x="103" y="195" width="10.5" height="17" rx="2" fill="#5f6d3b" ${o}/><rect x="103" y="195" width="10.5" height="5.5" rx="2" fill="#4c5830" ${o}/>`;
// Gloved fist wrapped around the rifle: palm, two finger creases, thumb.
const glove = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})">
    <circle r="8.4" fill="${GLOVE}" ${O}/>
    <path d="M-6 -2.5 Q0 -6 6 -2.5 M-6.4 1.8 Q0 -1.6 6.4 1.8" stroke="${INK}" stroke-width="1.2" fill="none" opacity=".55"/>
    <ellipse cx="-6.5" cy="4" rx="3.6" ry="2.8" fill="#7a6845" ${o}/>
    <path d="M-3 -6.5 Q1 -8 4 -6.8" stroke="#fff" stroke-opacity=".22" stroke-width="1.6" fill="none"/></g>`;

const SVG = `
<svg class="avatar" viewBox="0 0 260 300" xmlns="${NS}" role="img" aria-hidden="true">
<defs>
  <pattern id="avCamo" width="18" height="18" patternUnits="userSpaceOnUse">
    <rect x="0" y="0" width="6" height="4" fill="#4a562f"/><rect x="9" y="2" width="5" height="5" fill="#8c8757"/>
    <rect x="3" y="9" width="6" height="5" fill="#3c4426"/><rect x="12" y="11" width="6" height="4" fill="#9f9265"/>
    <rect x="0" y="14" width="4" height="4" fill="#5a683b"/><rect x="14" y="5" width="3" height="3" fill="#3c4426"/>
    <rect x="6" y="15" width="4" height="3" fill="#8c8757"/>
  </pattern>
  <linearGradient id="avShade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/>
  </linearGradient>
  <linearGradient id="avSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3c79c"/><stop offset="1" stop-color="#d9a376"/></linearGradient>
  <linearGradient id="avMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#63645e"/><stop offset="1" stop-color="#26272a"/></linearGradient>
  <linearGradient id="avWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b87840"/><stop offset="1" stop-color="#7c4a22"/></linearGradient>
  <linearGradient id="avBeam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff6c8" stop-opacity=".75"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></linearGradient>
  <radialGradient id="avLens" cx=".35" cy=".35" r=".75"><stop offset="0" stop-color="#d6f1ff"/><stop offset=".4" stop-color="#3f76b0"/><stop offset="1" stop-color="#0c1726"/></radialGradient>
  <radialGradient id="avStage" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#8a7a3a" stop-opacity=".55"/><stop offset="1" stop-color="#8a7a3a" stop-opacity="0"/></radialGradient>
  <filter id="avGlow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="b"/>
    <feFlood flood-color="#ffd75e" flood-opacity=".95"/><feComposite in2="b" operator="in" result="g"/>
    <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>

<!-- ground -->
<ellipse cx="130" cy="289" rx="126" ry="13" fill="url(#avStage)"/>
<ellipse cx="130" cy="288" rx="50" ry="6.5" fill="#000" opacity=".35"/>
<g stroke="#d9cb94" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".8">
  <path d="M82 289 Q80 280 76 274 M84 289 Q85 279 88 273 M86 289 Q90 283 95 280"/>
  <path d="M178 289 Q176 281 172 276 M181 289 Q183 280 187 275"/>
  <path d="M236 290 Q234 282 230 277 M239 290 Q241 281 245 277 M241 290 Q246 285 251 283"/>
</g>

<!-- РЕБ backpack + antennas (behind the body) -->
${up('reb', 1, `
  <rect x="86" y="90" width="88" height="24" rx="9" fill="${GEAR_DK}" ${O}/>
  <g class="av-antenna" style="transform-origin:166px 104px">
    <path d="M166 104 L182 26" stroke="#1f2022" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M168 94 L180 34" stroke="#6a6b66" stroke-width="1.1" stroke-dasharray="6 5"/>
    <circle class="av-led" cx="182.3" cy="24.5" r="3" fill="#7dff6a" stroke="#1f2022" stroke-width="1"/>
  </g>`)}
${up('reb', 2, `
  <g class="av-antenna b" style="transform-origin:94px 104px">
    <path d="M94 104 L78 30" stroke="#1f2022" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M92 94 L80 38" stroke="#6a6b66" stroke-width="1.1" stroke-dasharray="6 5"/>
    <circle class="av-led c" cx="77.7" cy="28.5" r="3" fill="#ff4a3d" stroke="#1f2022" stroke-width="1"/>
  </g>`)}
${up('reb', 3, `
  <g class="av-antenna c" style="transform-origin:104px 100px">
    <path d="M104 100 L62 56" stroke="#1f2022" stroke-width="3" stroke-linecap="round"/>
    <rect x="42" y="36" width="24" height="18" rx="2.5" fill="#3a3b37" ${o} transform="rotate(-18 54 45)"/>
    <path d="M47 41 H61 M47 45 H61 M47 49 H61" stroke="#5c5d57" stroke-width="1.2" transform="rotate(-18 54 45)"/>
    <circle class="av-led b" cx="63" cy="38" r="2.2" fill="#ffd23f"/>
  </g>`)}

<!-- speed lines (Берці 5) -->
${up('speed', 5, `<g class="av-dust" fill="#dccb9c">
  <circle cx="93" cy="284" r="5.5"/><circle cx="86" cy="279" r="3.8" style="animation-delay:-.3s"/>
  <circle cx="167" cy="284" r="5.5" style="animation-delay:-.45s"/><circle cx="174" cy="279" r="3.8" style="animation-delay:-.15s"/></g>`)}

<!-- legs -->
<g>
  <rect x="100" y="170" width="60" height="20" rx="7" fill="${UNI}" ${O}/>
  ${cloth(LEG)}
  <g transform="${MIRROR}">${cloth(LEG)}</g>
  ${POCKET}
  <g transform="${MIRROR}">${POCKET}</g>
  <path d="M127.5 184 L132.5 184 L131.5 198 L128.5 198 Z" fill="${INK}" opacity=".45"/>
  <path d="M106 229 Q115 232 124 229 M136 229 Q145 232 154 229" stroke="${INK}" stroke-width="1.3" opacity=".35" fill="none"/>
</g>
${up('speed', 3, `<g>
  <rect x="103" y="213" width="23" height="18" rx="6.5" fill="#34391f" ${O}/><rect x="134" y="213" width="23" height="18" rx="6.5" fill="#34391f" ${O}/>
  <rect x="107" y="216" width="15" height="4" rx="2" fill="#fff" opacity=".16"/><rect x="138" y="216" width="15" height="4" rx="2" fill="#fff" opacity=".16"/></g>`)}

<!-- feet: sneakers until Берці 1, then boots -->
${up('speed', 0, `<g>
  <g id="avSneaker">
    <path d="M102 256 H128 Q131 264 131 272 Q131 282 122 282 H106 Q97 282 98 273 Z" fill="#f2f0e8" ${O}/>
    <path d="M104 266 L126 261.5 M104 271 L126 266.5" stroke="#2f66d0" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M98 279 Q100 285.5 106 285.5 H122 Q131.5 285.5 131 279" stroke="#b9b6aa" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <path d="M109 258 L121 259" stroke="#b9b6aa" stroke-width="1.4"/>
  </g>
  <use href="#avSneaker" transform="${MIRROR}"/></g>`, 0)}
${up('speed', 1, `<g>
  <g id="avBoot">
    <path d="M101 249 H129 V270 Q136 272 136 279 Q136 285.5 128 285.5 H103 Q96 285.5 96 279 Q96 273 101 270 Z" fill="#9b7b4f" ${O}/>
    <path d="M129 250 V270 Q134 271.5 135.5 276" stroke="#000" stroke-opacity=".22" stroke-width="4" fill="none"/>
    <path d="M96 281 Q96 288.5 103 288.5 H128 Q136 288.5 136 281" stroke="${INK}" stroke-width="4.2" fill="none" stroke-linecap="round"/>
    <path d="M108 253 L122 256.5 M108 258 L122 261.5 M108 263 L122 266.5" stroke="#5e4a2c" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="112" cy="278" rx="8" ry="3" fill="#fff" opacity=".16"/>
  </g>
  <use href="#avBoot" transform="${MIRROR}"/></g>`)}
${up('speed', 2, `<g fill="#2f2a1c"><rect x="100" y="265" width="30" height="4.5" rx="1"/><rect x="130" y="265" width="30" height="4.5" rx="1"/>
  <rect x="112" y="264" width="6" height="6.5" rx="1" fill="#8b8b83"/><rect x="142" y="264" width="6" height="6.5" rx="1" fill="#8b8b83"/></g>`)}
${up('speed', 4, `<g><path d="M102 262 L114 250 L118.5 250 L106.5 262 Z" fill="#ffd23f"/><path d="M107.5 262 L119.5 250 L124 250 L112 262 Z" fill="#2f66d0"/>
  <g transform="${MIRROR}"><path d="M102 262 L114 250 L118.5 250 L106.5 262 Z" fill="#ffd23f"/><path d="M107.5 262 L119.5 250 L124 250 L112 262 Z" fill="#2f66d0"/></g></g>`)}

<!-- upper body (breathes) -->
<g class="av-upper">
  <rect x="121" y="86" width="18" height="18" rx="4" fill="url(#avSkin)" ${O}/>
  <path d="M121 96 H139" stroke="#000" stroke-opacity=".15" stroke-width="5"/>
  ${cloth('M92 104 Q130 95 168 104 Q179 108 177 120 L167 178 L93 178 L83 120 Q81 108 92 104 Z')}
  <path d="M117 99.5 L130 112 L143 99.5 Z" fill="#3b4028" ${o}/>
  <path d="M113 99 L121 111 L130 112 M147 99 L139 111 L130 112" stroke="${INK}" stroke-width="1.6" fill="none"/>

  ${up('hp', 1, `<g>
    <path d="M99 104 L113 104 L115 117 L101 117 Z" fill="${GEAR}" ${o}/><path d="M161 104 L147 104 L145 117 L159 117 Z" fill="${GEAR}" ${o}/>
    <path d="M92 146 L101 142 L101 171 L94 171 Z" fill="${GEAR_DK}" ${o}/><path d="M168 146 L159 142 L159 171 L166 171 Z" fill="${GEAR_DK}" ${o}/>
    <rect x="100" y="112" width="60" height="59" rx="9" fill="${GEAR}" ${O}/>
    <rect x="104" y="115" width="52" height="6" rx="3" fill="#fff" opacity=".1"/>
    <path d="M104 140 H156 M104 148 H156 M104 156 H156 M104 164 H156" stroke="${GEAR_DK}" stroke-width="2.2"/>
    <path d="M114 140 V166 M130 140 V166 M146 140 V166" stroke="${GEAR_DK}" stroke-width="1.2" opacity=".7"/>
    <rect x="100" y="112" width="60" height="59" rx="9" fill="url(#avShade)"/></g>`)}
  ${up('hp', 2, `<path d="M107 104 Q130 117 153 104 L151 96 Q130 109 109 96 Z" fill="${GEAR_DK}" ${O}/>`)}

  <rect x="93" y="167" width="74" height="10" rx="2" fill="#3a3a28" ${O}/>
  <rect x="124" y="165" width="12" height="14" rx="2" fill="#9a9a90" ${o}/><rect x="127" y="168.5" width="6" height="7" fill="#3a3a28"/>

  ${up('dmg', 4, `<g>
    <path d="M94 108 L162 170" stroke="#5b4326" stroke-width="10" stroke-linecap="round"/>
    <path d="M97 111 L159 167" stroke="#d9a441" stroke-width="6.5" stroke-dasharray="3 3.2"/>
    <path d="M94 108 L162 170" stroke="${INK}" stroke-width="10" stroke-linecap="round" fill="none" opacity=".25"/></g>`)}
  ${up('ebaly', 1, `<g>
    <rect x="103" y="113" width="11" height="14" rx="2" fill="#1d1f22" ${o}/>
    <circle cx="108.5" cy="118.5" r="3.2" fill="url(#avLens)" stroke="#000" stroke-width=".8"/>
    <circle class="av-led" cx="112" cy="124.5" r="1.3" fill="#ff3b30"/></g>`)}
  ${up('ebaly', 3, `<g>
    <rect x="118" y="116.5" width="18" height="11" rx="2" fill="#26321d" stroke="#d9c26a" stroke-width="1.2"/>
    <path d="M121.5 122 L125 125.5 L132.5 119" stroke="#8fff70" stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`)}
  ${up('dmg', 1, pouch(141))}
  ${up('dmg', 2, pouch(155))}
  ${up('dmg', 3, pouch(110, 12))}
  ${up('dmg', 5, `<g>
    <path d="M167 171 L171 176" stroke="#3a3a28" stroke-width="2.4"/>
    <ellipse cx="172" cy="183" rx="6" ry="7.5" fill="#4f5a2f" ${o}/>
    <path d="M168.5 178 H175.5 M168 183 H176 M168.5 188 H175.5" stroke="${INK}" stroke-width="1" opacity=".45"/>
    <path d="M170 175.5 L177 172" stroke="#b9b9b0" stroke-width="2" stroke-linecap="round"/>
    <circle cx="167.5" cy="176" r="2.4" fill="none" stroke="#b9b9b0" stroke-width="1.3"/></g>`)}

  <!-- head -->
  <g class="av-head">
    <ellipse cx="108" cy="76" rx="4.8" ry="6.8" fill="url(#avSkin)" ${O}/>
    <ellipse cx="152" cy="76" rx="4.8" ry="6.8" fill="url(#avSkin)" ${O}/>
    <path d="M108 64 Q108 42 130 42 Q152 42 152 64 V78 Q152 99.5 130 100.5 Q108 99.5 108 78 Z" fill="url(#avSkin)" ${O}/>
    <path d="M110.5 84 Q130 104 149.5 84 Q147.5 97 130 99.5 Q112.5 97 110.5 84 Z" fill="#8a6a48" opacity=".22"/>
    <ellipse cx="115.5" cy="85" rx="4.5" ry="2.4" fill="#e0876e" opacity=".35"/>
    <ellipse cx="144.5" cy="85" rx="4.5" ry="2.4" fill="#e0876e" opacity=".35"/>
    <g class="av-eyes">
      <ellipse cx="121" cy="76" rx="4.4" ry="5.1" fill="#fff" stroke="${INK}" stroke-width="1.4"/>
      <ellipse cx="139" cy="76" rx="4.4" ry="5.1" fill="#fff" stroke="${INK}" stroke-width="1.4"/>
      <circle cx="122.2" cy="77" r="2.5" fill="#2b2112"/><circle cx="140.2" cy="77" r="2.5" fill="#2b2112"/>
      <circle cx="123" cy="76" r=".85" fill="#fff"/><circle cx="141" cy="76" r=".85" fill="#fff"/>
    </g>
    <path d="M114.5 68.5 L127 70.5 M133 70.5 L145.5 68.5" stroke="#4a3520" stroke-width="3" stroke-linecap="round"/>
    <path d="M130 78 Q127.3 84 131 85" stroke="#b07e57" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M123 91 Q130 94.5 137.5 90" stroke="#6b3420" stroke-width="2.1" fill="none" stroke-linecap="round"/>
    <path d="M104.5 69 Q108 85 116.5 95 M155.5 69 Q152 85 143.5 95" stroke="#2f2a1c" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path id="avHelmet" d="M102 71 Q101 34 130 33 Q159 34 158 71 Q150 63.5 130 63 Q110 63.5 102 71 Z" fill="#5b6a3a" ${O}/>
    ${up('hp', 4, `<g>
      <path d="M102 71 Q101 34 130 33 Q159 34 158 71 Q150 63.5 130 63 Q110 63.5 102 71 Z" fill="url(#avCamo)"/>
      <rect x="99.5" y="54" width="5.5" height="11" rx="1.5" fill="#2d2d2b" ${o}/><rect x="155" y="54" width="5.5" height="11" rx="1.5" fill="#2d2d2b" ${o}/>
      <rect x="123.5" y="33" width="13" height="8" rx="2" fill="#2d2d2b" ${o}/></g>`)}
    <path d="M150 42 Q158 52 158 71 Q154.5 67 150 65 Z" fill="#000" opacity=".2"/>
    <path d="M110 51 Q117 39 131 37.5" stroke="#fff" stroke-opacity=".28" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${up('fpv', 1, `<g>
      <path d="M103 55 Q130 45 157 55" stroke="#1e1f22" stroke-width="4.2" fill="none"/>
      <rect x="112.5" y="42" width="35" height="14.5" rx="6" fill="#1f2226" ${O}/>
      <rect x="115.5" y="44.5" width="12.5" height="9.5" rx="4" fill="url(#avLens)"/>
      <rect x="132" y="44.5" width="12.5" height="9.5" rx="4" fill="url(#avLens)"/>
      <path d="M147 45.5 L153 37" stroke="#1e1f22" stroke-width="2" stroke-linecap="round"/>
      <circle class="av-led" cx="153.4" cy="36.3" r="1.9" fill="#ff5a3c"/></g>`)}
  </g>

  <!-- rifle (port arms) -->
  <g transform="translate(92 182) rotate(-45)">
    ${up('rate', 5, `<path class="av-beam" d="M100 -13.5 L178 -38 L178 10 Z" fill="url(#avBeam)"/>`)}
    <path d="M-3 -6 L26 -5 L26 5 L4 9.5 Q-4 10.5 -3.5 3 Z" fill="url(#avWood)" ${O}/>
    <path d="M-3 -6 L1 -6 L1 9.8 L-3 9.5 Z" fill="#2a2a28"/>
    ${up('rate', 0, `<path d="M58 4 L70 4 Q73 14 79 24 L68 28.5 Q61.5 17 58 4 Z" fill="#3a3834" ${O}/>`, 2)}
    ${up('rate', 3, `<g><rect x="59" y="2" width="11" height="8" fill="#3a3834" ${o}/><circle cx="64.5" cy="18" r="12.5" fill="#3a3834" ${O}/>
      <circle cx="64.5" cy="18" r="5.5" fill="#55534c" ${o}/><path d="M56 12 A11 11 0 0 1 70 8.5" stroke="#fff" stroke-opacity=".18" stroke-width="2.2" fill="none"/></g>`)}
    <path d="M44 4 L53 4 L50.5 20 Q49.5 22.5 46.5 22.5 L41.5 22.5 Q39 21.5 40 18.5 Z" fill="#2f2f2c" ${o}/>
    <path d="M53 5 Q56.5 12 60.5 5" stroke="${INK}" stroke-width="1.6" fill="none"/>
    <rect x="24" y="-8" width="46" height="13" rx="2" fill="url(#avMetal)" ${O}/>
    <path d="M28 -4 H66" stroke="#fff" stroke-opacity=".18" stroke-width="1.6"/>
    <rect x="68" y="-10.5" width="32" height="4.5" rx="2" fill="#3a3b3d" ${o}/>
    <rect x="68" y="-6" width="33" height="11" rx="3" fill="url(#avWood)" ${O}/>
    <path d="M72 -2 H97 M72 1.5 H97" stroke="#6a3d1a" stroke-width=".9" opacity=".6"/>
    <rect x="100" y="-3" width="26" height="5" fill="#2b2c2e" ${o}/>
    <path d="M114 -3 L116 -10 L119 -10 L119 -3 Z" fill="#2b2c2e" ${o}/>
    ${up('rate', 1, `<g><rect x="37" y="-12.5" width="14" height="5" fill="#1d1d1f"/>
      <rect x="33" y="-23" width="21" height="11.5" rx="3.5" fill="#2a2b2e" ${O}/>
      <ellipse class="av-glint" cx="53.5" cy="-17.2" rx="2" ry="4.2" fill="#ff5a4a"/></g>`)}
    ${up('rate', 2, `<path d="M81.5 5 L90 5 L91 20.5 Q91 23.5 88 23.5 L84 23.5 Q81 23.5 81 20.5 Z" fill="#2f2f2c" ${o}/>`)}
    ${up('rate', 4, `<g><rect x="124" y="-4.8" width="13" height="8.6" rx="1.5" fill="#3d3e40" ${o}/>
      <path d="M127.5 -4.8 V3.8 M131 -4.8 V3.8 M134.5 -4.8 V3.8" stroke="#1a1a1c" stroke-width="1.2"/></g>`)}
    ${up('rate', 5, `<g><rect x="86" y="-17.5" width="14" height="7.5" rx="2.2" fill="#222326" ${o}/>
      <circle class="av-glint" cx="100.5" cy="-13.7" r="2.6" fill="#fff6c8"/></g>`)}
  </g>

  <!-- arms, hands -->
  ${sleeve('M88 112 L80 146 L127 156')}
  ${sleeve('M172 112 L185 141 L156 126')}
  <g transform="translate(83.7 130.5) rotate(13)">
    <rect x="-6" y="-4.5" width="12" height="4.5" fill="#1f5fd1"/><rect x="-6" y="0" width="12" height="4.5" fill="#ffd23f"/>
    <rect x="-6" y="-4.5" width="12" height="9" fill="none" stroke="${INK}" stroke-width="1.1"/>
  </g>
  ${up('hp', 5, `<g><ellipse cx="80" cy="146" rx="9.5" ry="8.5" fill="#34391f" ${O}/><ellipse cx="185" cy="141" rx="9.5" ry="8.5" fill="#34391f" ${O}/>
    <ellipse cx="78" cy="143" rx="4.5" ry="2.2" fill="#fff" opacity=".16"/><ellipse cx="183" cy="138" rx="4.5" ry="2.2" fill="#fff" opacity=".16"/></g>`)}
  ${up('ebaly', 2, `<g transform="translate(102 150) rotate(12)">
    <rect x="-11.5" y="-8" width="23" height="15.5" rx="2.5" fill="#1d1f22" ${o}/>
    <rect x="-9.5" y="-6" width="19" height="11.5" rx="1" fill="#0f2a1a"/>
    <path class="av-chart" d="M-7.5 3 L-3.5 -1 L0 1.2 L4 -4 L7.5 -2" stroke="#6dff7a" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`)}
  ${glove(131.5, 157, -20)}
  ${glove(152.5, 123.5, 25)}
  ${up('hp', 3, `<g><path d="M75 117 Q77 101 95 103 Q101 110 98 123 Q86 126 75 117 Z" fill="${GEAR}" ${O}/>
    <path d="M185 117 Q183 101 165 103 Q159 110 162 123 Q174 126 185 117 Z" fill="${GEAR}" ${O}/>
    <path d="M80 110 Q85 105 93 106 M180 110 Q175 105 167 106" stroke="#fff" stroke-opacity=".2" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>`)}
</g>

<!-- FPV drones (foreground) -->
${up('fpv', 1, `<g transform="translate(206 64)">${drone('a').replace('PAYLOAD', payload)}</g>`)}
${up('fpv', 3, `<g transform="translate(40 124)">${drone('b').replace('PAYLOAD', '')}</g>`)}

<!-- НРК (UGV) -->
${up('nrk', 1, `<g transform="translate(46 262)">
  <ellipse cx="0" cy="26" rx="36" ry="5" fill="#000" opacity=".3"/>
  <g class="av-ugv">
    <g class="av-antenna d" style="transform-origin:-18px -14px">
      <path d="M-18 -14 L-22.5 -38" stroke="#1f2022" stroke-width="1.9" stroke-linecap="round"/>
      <circle class="av-led" cx="-22.8" cy="-39" r="2.1" fill="#7dff6a"/></g>
    <path d="M-27 6 L-23 -14 L23 -14 L28 6 Z" fill="#56633a"/><path d="M-27 6 L-23 -14 L23 -14 L28 6 Z" fill="url(#avCamo)"/>
    <path d="M-27 6 L-23 -14 L23 -14 L28 6 Z" fill="none" ${O}/>
    <rect x="-9" y="-11" width="16" height="14" rx="2" fill="#f4f0e6" ${o}/>
    <path d="M-1 -8.5 V1 M-5.8 -3.8 H3.8" stroke="#d23a32" stroke-width="3"/>
    <rect x="14" y="-21" width="11" height="8" rx="2" fill="#2a2b2e" ${o}/><circle cx="23" cy="-17" r="2.2" fill="url(#avLens)"/>
    <rect x="-31" y="5" width="62" height="19" rx="9.5" fill="#26272a" ${O}/>
    <rect class="av-tread" x="-28" y="8" width="56" height="13" rx="6.5" fill="none" stroke="#5a5b60" stroke-width="2.4" stroke-dasharray="3 3"/>
    <g fill="#3a3b3e" stroke="#151516" stroke-width="1.2"><circle cx="-20" cy="14.5" r="5"/><circle cx="-7" cy="14.5" r="5"/><circle cx="7" cy="14.5" r="5"/><circle cx="20" cy="14.5" r="5"/></g>
  </g></g>`)}
</svg>`;

const MAX = Object.fromEntries(UPGRADES.map((u) => [u.id, u.max]));
const GEAR_TOTAL = UPGRADES.reduce((s, u) => s + u.max, 0);

export function gearLevel(bank) {
  return { n: UPGRADES.reduce((s, u) => s + Math.min(u.max, bank.up[u.id] || 0), 0), m: GEAR_TOTAL };
}

export function createAvatar(host) {
  host.innerHTML = SVG;
  const svg = host.querySelector('svg');
  const parts = Array.from(svg.querySelectorAll('[data-up]'));
  let levels = {};
  const lvlOf = (id) => levels[id] || 0;
  const shows = (el, lvl) => lvl >= +(el.dataset.min || 0) && (el.dataset.max == null || lvl <= +el.dataset.max);

  function apply() {
    for (const el of parts) {
      el.style.display = shows(el, lvlOf(el.dataset.up)) ? '' : 'none';
      el.classList.remove('ghost', 'hl');
    }
  }

  // Star burst at the centre of a freshly equipped layer.
  function sparkle(el) {
    const r = el.getBoundingClientRect(), m = svg.getScreenCTM();
    if ((!r.width && !r.height) || !m) return;
    const p = new DOMPoint(r.left + r.width / 2, r.top + r.height / 2).matrixTransform(m.inverse());
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    let rays = '<circle r="11" fill="#fff6c8" opacity=".85"/>';
    for (let i = 0; i < 8; i++) rays += `<path d="M0 -4 L1.8 0 L0 4 L-1.8 0 Z" fill="#ffe27a" transform="rotate(${i * 45}) translate(0 -17)"/>`;
    g.innerHTML = `<g class="av-spark">${rays}</g>`;
    svg.appendChild(g);
    setTimeout(() => g.remove(), 900);
  }

  return {
    update(bank, bought) {
      levels = { ...bank.up };
      apply();
      if (!bought) return;
      const lvl = lvlOf(bought);
      const fresh = parts.filter((el) => el.dataset.up === bought && +(el.dataset.min || 0) === lvl && shows(el, lvl));
      for (const el of fresh) { el.classList.remove('pop'); void el.getBoundingClientRect(); el.classList.add('pop'); }
      fresh.slice(0, 3).forEach(sparkle);
      console.log('AVATAR equip ' + bought + ' lvl ' + lvl + ' (' + fresh.length + ' layers)');
    },
    // Hover/press on a Маркет card: glow what the upgrade already gives, ghost what the next level adds.
    preview(id) {
      apply();
      if (!id) return;
      const lvl = lvlOf(id), next = lvl < MAX[id] ? lvl + 1 : lvl;
      for (const el of parts) {
        if (el.dataset.up !== id) continue;
        const now = shows(el, lvl), then = shows(el, next);
        if (now && then) el.classList.add('hl');
        else if (!now && then) { el.style.display = ''; el.classList.add('ghost'); }
        else if (now && !then) el.style.display = 'none';
      }
    },
  };
}
