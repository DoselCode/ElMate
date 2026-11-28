"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Foto de la variante elegida en la página del producto: el selector de opciones la cambia al tocar
 * un color y la galería salta a esa foto. Arranca con la foto de la variante que viene elegida.
 */
type SelectedImage = { image: string | null; setImage: (image: string | null) => void };

const SelectedImageContext = createContext<SelectedImage>({ image: null, setImage: () => {} });

export function SelectedImageProvider({ initial, children }: { initial: string | null; children: ReactNode }) {
  const [image, setImage] = useState(initial);
  const value = useMemo(() => ({ image, setImage }), [image]);
  return <SelectedImageContext.Provider value={value}>{children}</SelectedImageContext.Provider>;
}

export const useSelectedImage = () => useContext(SelectedImageContext);
