/** Letras del logo (EL / MA / TE) dibujadas en una celda de 40 x 48, trazo grueso y cuadrado como en la marca. */
export const LETTERS = {
  E: "M0 0H40V11H11V19H34V29H11V37H40V48H0Z",
  L: "M0 0H11V37H40V48H0Z",
  M: "M0 48V0H11L20 22L29 0H40V48H29V24L23 37H17L11 24V48Z",
  A: "M0 48L14 0H26L40 48H29L27 39H13L11 48ZM16 29H24L20 14Z",
  T: "M0 0H40V11H25.5V48H14.5V11H0Z",
} as const;

/** Posición de cada letra en el logo apilado. La A va azul y girada unos 9°, como en la marca. */
export const LOGO: { letter: keyof typeof LETTERS; x: number; y: number; blue?: boolean; tilt?: number }[] = [
  { letter: "E", x: 0, y: 0 },
  { letter: "L", x: 46, y: 0 },
  { letter: "M", x: 0, y: 56 },
  { letter: "A", x: 47, y: 56, blue: true, tilt: -9 },
  { letter: "T", x: 0, y: 112 },
  { letter: "E", x: 46, y: 112 },
];

/** El mismo logo en una sola línea (ELMATE): 6 letras de 40 de ancho con 6 de separación. */
export const LOGO_ROW: typeof LOGO = ["E", "L", "M", "A", "T", "E"].map((letter, i) => ({
  letter: letter as keyof typeof LETTERS,
  x: i * 46 + (letter === "A" ? 1 : 0),
  y: 0,
  ...(letter === "A" ? { blue: true, tilt: -9 } : {}),
}));

export const BLUE = "#1a7fc7";

export const letterTransform = (l: (typeof LOGO)[number]) =>
  `translate(${l.x} ${l.y})${l.tilt ? ` rotate(${l.tilt} 0 48)` : ""}`;

/** Logo de ElMate en letras apiladas (estático). `fill` es el color de las letras; la A siempre va azul. */
export function BrandLetters({ fill = "#0b1119", className = "" }: { fill?: string; className?: string }) {
  return (
    <svg viewBox="0 -4 88 164" aria-hidden className={className}>
      {LOGO.map((l, i) => (
        <path key={i} transform={letterTransform(l)} d={LETTERS[l.letter]} fill={l.blue ? BLUE : fill} fillRule="evenodd" />
      ))}
    </svg>
  );
}

/** Logo lineal (ELMATE). `blue` permite una A más clara para fondos oscuros o con foto. */
export function BrandLetterRow({ fill = "#0b1119", blue = BLUE, className = "" }: { fill?: string; blue?: string; className?: string }) {
  return (
    <svg viewBox="0 -8 270 62" aria-hidden className={className}>
      {LOGO_ROW.map((l, i) => (
        <path key={i} transform={letterTransform(l)} d={LETTERS[l.letter]} fill={l.blue ? blue : fill} fillRule="evenodd" />
      ))}
    </svg>
  );
}
