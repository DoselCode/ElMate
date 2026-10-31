import { BLUE, LETTERS, LOGO, letterTransform } from "../layout/brand-letters";

/**
 * Ilustración animada del hero: un termo se inclina y ceba agua en el mate; después sigue saliendo vapor.
 * Es SVG + CSS puro (las animaciones están en globals.css, clases brew-*): sin JavaScript ni video.
 * Con "reducir movimiento" se ve el mate ya cebado, quieto.
 */
export function HeroBrew({ label }: { label: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      role="img"
      aria-label={label}
      className="size-full"
    >
      <defs>
        <radialGradient id="brew-glow" cx="62%" cy="72%" r="60%">
          <stop offset="0" stopColor="#1a7fc7" stopOpacity="0.45" />
          <stop offset="1" stopColor="#1a7fc7" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="brew-steel" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#7d8896" />
          <stop offset="0.45" stopColor="#e9eef4" />
          <stop offset="1" stopColor="#8b96a4" />
        </linearGradient>
        <linearGradient id="brew-gourd" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#a8754a" />
          <stop offset="1" stopColor="#573620" />
        </linearGradient>
      </defs>

      <rect width="400" height="400" fill="#0b1119" />
      <rect width="400" height="400" fill="url(#brew-glow)" />
      <circle cx="330" cy="70" r="120" fill="#1a7fc7" opacity="0.06" />

      {/* Mate (al 80 %, apoyado sobre su base) */}
      <g transform="translate(250 366) scale(0.8) translate(-250 -366)">
        <ellipse cx="250" cy="370" rx="84" ry="9" fill="#000" opacity="0.45" />
        <path
          d="M186 274C186 338 216 366 250 366S314 338 314 274Z"
          fill="url(#brew-gourd)"
        />
        <path
          d="M190 304C215 316 285 316 310 304"
          stroke="#1a7fc7"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse
          cx="250"
          cy="274"
          rx="64"
          ry="14"
          fill="#2a1b12"
          stroke="#cfd6de"
          strokeWidth="3"
        />
        <path d="M196 274C215 250 285 250 304 274Z" fill="#7f9c3d" />
        <path
          className="brew-wet"
          d="M196 274C215 250 285 250 304 274Z"
          fill="#2f4a1c"
        />
        <ellipse
          className="brew-ripple"
          cx="248"
          cy="266"
          rx="10"
          ry="3"
          fill="none"
          stroke="#8fd0ff"
          strokeWidth="2"
        />
        <path
          d="M268 266 312 206"
          stroke="#d7dde4"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="313" cy="205" r="4.5" fill="#d7dde4" />
      </g>

      {/* Logo: las letras caen una a una cuando el agua toca la yerba */}
      <g transform="translate(300 26)">
        {LOGO.map((l, i) => (
          <g key={i} transform={letterTransform(l)}>
            <path
              className="brew-letter"
              style={{ "--k": i } as React.CSSProperties}
              d={LETTERS[l.letter]}
              fill={l.blue ? BLUE : "#eef2f7"}
              fillRule="evenodd"
            />
          </g>
        ))}
      </g>

      {/* Vapor del mate */}
      <g
        transform="translate(0 28)"
        fill="none"
        stroke="#e9eef4"
        strokeWidth="4"
        strokeLinecap="round"
      >
        <path
          className="brew-vapor"
          style={{ "--d": "0s" } as React.CSSProperties}
          d="M232 248c-9-10 9-20 0-30s9-20 0-30"
        />
        <path
          className="brew-vapor"
          style={{ "--d": "0.7s" } as React.CSSProperties}
          d="M252 244c-9-10 9-20 0-30s9-20 0-30"
        />
        <path
          className="brew-vapor"
          style={{ "--d": "1.4s" } as React.CSSProperties}
          d="M272 248c-9-10 9-20 0-30s9-20 0-30"
        />
      </g>

      {/* Chorro de agua */}
      <path
        className="brew-stream"
        d="M241 222C242 244 246 266 248 281"
        pathLength={1}
        stroke="#7cc4ff"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Termo: arranca parado a la izquierda, se inclina sobre el mate y vuelve a su lugar */}
      <g transform="translate(137 180)">
        <g className="brew-termo">
          <rect
            x="-34"
            y="-86"
            width="68"
            height="182"
            rx="16"
            fill="url(#brew-steel)"
          />
          <rect x="-34" y="-40" width="68" height="14" fill="#1a7fc7" />
          <rect x="-34" y="76" width="68" height="20" rx="14" fill="#0b1119" />
          <rect x="-28" y="-104" width="56" height="22" rx="8" fill="#0b1119" />
          <rect x="-30" y="-92" width="60" height="6" rx="3" fill="#1a7fc7" />
          <rect x="-9" y="-111" width="18" height="8" rx="3" fill="#0b1119" />
          <rect
            x="-24"
            y="-78"
            width="7"
            height="146"
            rx="3.5"
            fill="#fff"
            opacity="0.35"
          />
        </g>
      </g>
    </svg>
  );
}
