import React from 'react';

interface FlagIconProps {
  code: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * High-precision vector SVG flags for supported languages.
 * Self-contained, zero-dependency, works seamlessly across Web and Windows WebView2.
 */
export const FlagIcon: React.FC<FlagIconProps> = ({ code, className = 'w-5 h-3.5', style }) => {
  const norm = (code || '').toLowerCase().replace('_', '-');

  const baseClasses = `inline-block shrink-0 overflow-hidden rounded-[2px] shadow-xs ring-1 ring-black/15 dark:ring-white/20 select-none align-middle ${className}`;

  // Normalize language codes
  let key = norm;
  if (norm === 'zh-cn' || norm === 'zh-hans') key = 'zh';
  else if (norm === 'zh-tw' || norm === 'zh-hant' || norm === 'zh-hk') key = 'zh-tw';
  else if (norm.startsWith('en')) key = 'en';
  else if (norm.startsWith('ja')) key = 'ja';
  else if (norm.startsWith('tr')) key = 'tr';
  else if (norm.startsWith('vi')) key = 'vi';
  else if (norm.startsWith('pt')) key = 'pt';
  else if (norm.startsWith('ko')) key = 'ko';
  else if (norm.startsWith('ru')) key = 'ru';
  else if (norm.startsWith('ar')) key = 'ar';
  else if (norm.startsWith('es')) key = 'es';
  else if (norm.startsWith('my') || norm.startsWith('ms')) key = 'my';
  else if (norm.startsWith('fa')) key = 'fa';

  switch (key) {
    // 🇮🇷 Iran / Persian
    case 'fa':
      return (
        <svg viewBox="0 0 640 480" className={baseClasses} style={style} aria-label="Flag of Iran">
          <g fillRule="evenodd">
            <path fill="#239f40" d="M0 0h640v160H0z" />
            <path fill="#ffffff" d="M0 160h640v160H0z" />
            <path fill="#da0000" d="M0 320h640v160H0z" />
            {/* Center Emblem of Iran (Tulip / 4 crescents and sword) */}
            <g fill="#da0000" transform="translate(320, 240) scale(1.1)">
              {/* Central sword / alif */}
              <path d="M-2.5 -65 L2.5 -65 L2.5 50 L-2.5 50 Z" />
              {/* Tashdid above sword */}
              <path d="M-8 -72 C-8 -78 -3 -80 0 -75 C3 -80 8 -78 8 -72 C6 -70 4 -72 0 -70 C-4 -72 -6 -70 -8 -72 Z" />
              {/* Inner crescents */}
              <path d="M-7 -45 C-22 -25 -22 15 -7 38 C-14 25 -14 -10 -7 -45 Z" />
              <path d="M7 -45 C22 -25 22 15 7 38 C14 25 14 -10 7 -45 Z" />
              {/* Outer crescents */}
              <path d="M-18 -20 C-48 5 -38 48 -14 55 C-32 45 -36 18 -18 -20 Z" />
              <path d="M18 -20 C48 5 38 48 14 55 C32 45 36 18 18 -20 Z" />
            </g>
          </g>
        </svg>
      );

    // 🇨🇳 China (Simplified Chinese)
    case 'zh':
      return (
        <svg viewBox="0 0 640 480" className={baseClasses} style={style} aria-label="Flag of China">
          <path fill="#de2910" d="M0 0h640v480H0z" />
          <g fill="#ffde00">
            {/* Large Star */}
            <polygon points="100,40 112,78 152,78 120,102 132,140 100,116 68,140 80,102 48,78 88,78" />
            {/* 4 Smaller Stars */}
            <polygon points="200,24 205,39 220,39 208,48 212,62 200,53 188,62 192,48 180,39 195,39" transform="rotate(23 200 40)" />
            <polygon points="240,74 245,89 260,89 248,98 252,112 240,103 228,112 232,98 220,89 235,89" transform="rotate(45 240 90)" />
            <polygon points="240,144 245,159 260,159 248,168 252,182 240,173 228,182 232,168 220,159 235,159" transform="rotate(70 240 160)" />
            <polygon points="200,194 205,209 220,209 208,218 212,232 200,223 188,232 192,218 180,209 195,209" transform="rotate(92 200 210)" />
          </g>
        </svg>
      );

    // 🇹🇼 Taiwan (Traditional Chinese)
    case 'zh-tw':
      return (
        <svg viewBox="0 0 640 480" className={baseClasses} style={style} aria-label="Flag of Taiwan">
          <path fill="#fe0000" d="M0 0h640v480H0z" />
          <path fill="#000095" d="M0 0h320v240H0z" />
          {/* 12-ray white sun */}
          <circle cx="160" cy="120" r="45" fill="#ffffff" />
          <circle cx="160" cy="120" r="38" fill="#000095" />
          <circle cx="160" cy="120" r="32" fill="#ffffff" />
          {Array.from({ length: 12 }).map((_, i) => (
            <polygon
              key={i}
              points="155,60 165,60 160,35"
              fill="#ffffff"
              transform={`rotate(${i * 30} 160 120)`}
            />
          ))}
        </svg>
      );

    // 🇺🇸 English (US Flag)
    case 'en':
      return (
        <svg viewBox="0 0 640 480" className={baseClasses} style={style} aria-label="Flag of United States">
          <g fillRule="evenodd">
            {/* 13 Stripes */}
            <path fill="#b22234" d="M0 0h640v480H0z" />
            {Array.from({ length: 6 }).map((_, i) => (
              <rect key={i} y={(i * 2 + 1) * 36.92} width="640" height="36.92" fill="#ffffff" />
            ))}
            {/* Canton */}
            <rect width="280" height="258.46" fill="#3c3b6e" />
            {/* Simplified stars pattern */}
            <g fill="#ffffff">
              {[30, 80, 130, 180, 230].map((x, xi) =>
                [35, 80, 125, 170, 215].map((y, yi) => (
                  <circle key={`${xi}-${yi}`} cx={x} cy={y} r="5.5" />
                ))
              )}
              {[55, 105, 155, 205].map((x, xi) =>
                [57.5, 102.5, 147.5, 192.5].map((y, yi) => (
                  <circle key={`mid-${xi}-${yi}`} cx={x} cy={y} r="5" />
                ))
              )}
            </g>
          </g>
        </svg>
      );

    // 🇯🇵 Japan
    case 'ja':
      return (
        <svg viewBox="0 0 640 480" className={baseClasses} style={style} aria-label="Flag of Japan">
          <path fill="#ffffff" d="M0 0h640v480H0z" />
          <circle cx="320" cy="240" r="135" fill="#bc002d" />
        </svg>
      );

    // 🇹🇷 Turkey
    case 'tr':
      return (
        <svg viewBox="0 0 640 480" className={baseClasses} style={style} aria-label="Flag of Turkey">
          <path fill="#e30a17" d="M0 0h640v480H0z" />
          {/* Crescent */}
          <circle cx="260" cy="240" r="120" fill="#ffffff" />
          <circle cx="290" cy="240" r="96" fill="#e30a17" />
          {/* 5-pointed star */}
          <g fill="#ffffff" transform="translate(385 240) rotate(-19)">
            <polygon points="0,-45 13,-14 47,-14 19,7 30,38 0,17 -30,38 -19,7 -47,-14 -13,-14" />
          </g>
        </svg>
      );

    // 🇻🇳 Vietnam
    case 'vi':
      return (
        <svg viewBox="0 0 640 480" className={baseClasses} style={style} aria-label="Flag of Vietnam">
          <path fill="#da251d" d="M0 0h640v480H0z" />
          <polygon
            fill="#ffff00"
            points="320,110 357,224 476,224 380,294 417,408 320,338 223,408 260,294 164,224 283,224"
          />
        </svg>
      );

    // 🇧🇷 Brazil / Portuguese
    case 'pt':
      return (
        <svg viewBox="0 0 640 480" className={baseClasses} style={style} aria-label="Flag of Brazil">
          <path fill="#009c3b" d="M0 0h640v480H0z" />
          <polygon points="320,45 580,240 320,435 60,240" fill="#ffdf00" />
          <circle cx="320" cy="240" r="105" fill="#002776" />
          {/* Curved white band */}
          <path
            d="M218 250 C260 215 375 220 422 250 C375 205 260 200 218 250 Z"
            fill="#ffffff"
          />
        </svg>
      );

    // 🇰🇷 South Korea
    case 'ko':
      return (
        <svg viewBox="0 0 640 480" className={baseClasses} style={style} aria-label="Flag of South Korea">
          <path fill="#ffffff" d="M0 0h640v480H0z" />
          {/* Taegeuk */}
          <g transform="translate(320 240) rotate(-34)">
            <path d="M-100 0 A100 100 0 0 1 100 0 A50 50 0 0 1 0 0 A50 50 0 0 0 -100 0 Z" fill="#cd2e3a" />
            <path d="M-100 0 A100 100 0 0 0 100 0 A50 50 0 0 0 0 0 A50 50 0 0 1 -100 0 Z" fill="#0047a0" />
          </g>
          {/* 4 Trigrams in corners */}
          <g fill="#000000">
            {/* Top-Left (Geon) */}
            <g transform="translate(150 120) rotate(34)">
              <rect x="-40" y="-22" width="80" height="8" rx="2" />
              <rect x="-40" y="-6" width="80" height="8" rx="2" />
              <rect x="-40" y="10" width="80" height="8" rx="2" />
            </g>
            {/* Bottom-Right (Gon) */}
            <g transform="translate(490 360) rotate(34)">
              <rect x="-40" y="-22" width="36" height="8" rx="2" />
              <rect x="4" y="-22" width="36" height="8" rx="2" />
              <rect x="-40" y="-6" width="36" height="8" rx="2" />
              <rect x="4" y="-6" width="36" height="8" rx="2" />
              <rect x="-40" y="10" width="36" height="8" rx="2" />
              <rect x="4" y="10" width="36" height="8" rx="2" />
            </g>
            {/* Top-Right (Gam) */}
            <g transform="translate(490 120) rotate(-34)">
              <rect x="-40" y="-22" width="36" height="8" rx="2" />
              <rect x="4" y="-22" width="36" height="8" rx="2" />
              <rect x="-40" y="-6" width="80" height="8" rx="2" />
              <rect x="-40" y="10" width="36" height="8" rx="2" />
              <rect x="4" y="10" width="36" height="8" rx="2" />
            </g>
            {/* Bottom-Left (Ri) */}
            <g transform="translate(150 360) rotate(-34)">
              <rect x="-40" y="-22" width="80" height="8" rx="2" />
              <rect x="-40" y="-6" width="36" height="8" rx="2" />
              <rect x="4" y="-6" width="36" height="8" rx="2" />
              <rect x="-40" y="10" width="80" height="8" rx="2" />
            </g>
          </g>
        </svg>
      );

    // 🇷🇺 Russia
    case 'ru':
      return (
        <svg viewBox="0 0 640 480" className={baseClasses} style={style} aria-label="Flag of Russia">
          <path fill="#ffffff" d="M0 0h640v160H0z" />
          <path fill="#0039a6" d="M0 160h640v160H0z" />
          <path fill="#d52b1e" d="M0 320h640v160H0z" />
        </svg>
      );

    // 🇸🇦 Saudi Arabia / Arabic
    case 'ar':
      return (
        <svg viewBox="0 0 640 480" className={baseClasses} style={style} aria-label="Flag of Saudi Arabia">
          <path fill="#006c35" d="M0 0h640v480H0z" />
          {/* Stylized Arabic script & sword */}
          <g fill="#ffffff" transform="translate(320, 220)">
            {/* Horizontal Sword */}
            <rect x="-160" y="60" width="300" height="12" rx="3" />
            <polygon points="-160,56 -190,66 -160,76" />
            <rect x="130" y="46" width="12" height="40" rx="2" />
            <circle cx="152" cy="66" r="8" />
            {/* Calligraphy bar representations */}
            <path d="M-170 -40 C-150 -80 -100 -50 -70 -70 C-40 -40 0 -80 30 -60 C60 -80 110 -50 140 -70 C160 -50 170 -40 170 -25 C140 -20 100 -30 60 -25 C20 -20 -30 -30 -70 -25 C-120 -20 -150 -35 -170 -40 Z" />
            <circle cx="-110" cy="-80" r="5" />
            <circle cx="-40" cy="-85" r="5" />
            <circle cx="40" cy="-85" r="5" />
            <circle cx="110" cy="-80" r="5" />
          </g>
        </svg>
      );

    // 🇪🇸 Spain
    case 'es':
      return (
        <svg viewBox="0 0 640 480" className={baseClasses} style={style} aria-label="Flag of Spain">
          <path fill="#aa151b" d="M0 0h640v120H0zM0 360h640v120H0z" />
          <path fill="#f1bf00" d="M0 120h640v240H0z" />
          {/* Simplified Coat of Arms */}
          <g transform="translate(180, 240)">
            <rect x="-30" y="-40" width="60" height="75" rx="10" fill="#aa151b" stroke="#f1bf00" strokeWidth="4" />
            <circle cx="0" cy="-50" r="12" fill="#aa151b" stroke="#f1bf00" strokeWidth="3" />
            <rect x="-45" y="-45" width="8" height="85" fill="#ffffff" stroke="#aa151b" strokeWidth="2" />
            <rect x="37" y="-45" width="8" height="85" fill="#ffffff" stroke="#aa151b" strokeWidth="2" />
          </g>
        </svg>
      );

    // 🇲🇾 Malaysia
    case 'my':
      return (
        <svg viewBox="0 0 640 480" className={baseClasses} style={style} aria-label="Flag of Malaysia">
          {/* 14 Stripes */}
          <g fill="#cc0000">
            <rect width="640" height="480" fill="#ffffff" />
            {Array.from({ length: 7 }).map((_, i) => (
              <rect key={i} y={i * 68.57} width="640" height="34.28" fill="#cc0000" />
            ))}
          </g>
          {/* Canton */}
          <rect width="320" height="274.28" fill="#000066" />
          {/* Yellow Crescent */}
          <circle cx="145" cy="137" r="75" fill="#ffcc00" />
          <circle cx="165" cy="137" r="65" fill="#000066" />
          {/* 14-pointed Star */}
          <g fill="#ffcc00">
            {Array.from({ length: 14 }).map((_, i) => (
              <polygon
                key={i}
                points="200,137 250,132 232,137 250,142"
                transform={`rotate(${i * (360 / 14)} 200 137)`}
              />
            ))}
          </g>
        </svg>
      );

    default:
      return (
        <span className={`${baseClasses} bg-slate-200 dark:bg-slate-700 text-[10px] font-mono font-bold flex items-center justify-center text-slate-700 dark:text-slate-300`}>
          {code.slice(0, 2).toUpperCase()}
        </span>
      );
  }
};
export default FlagIcon;
