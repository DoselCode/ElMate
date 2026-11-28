"use client";

import { useEffect, useRef, useState } from "react";
import { InstagramLogo } from "@phosphor-icons/react";
import { instagramEmbedSrc, isInstagramEmbedMessage } from "@/shared/instagram";

/** Tiempo que se espera, después de que el iframe termina de cargar, el aviso de Instagram. */
const GRACE_MS = 6000;
/**
 * Tope desde que la publicación entra en pantalla: cuando Instagram limita, a veces deja la respuesta colgada
 * y el iframe nunca termina de cargar. Un embed que anda avisa en pocos segundos.
 */
const VISIBLE_TIMEOUT_MS = 15000;

const frameClass = "aspect-[5/7] w-full rounded-2xl border border-border bg-surface";

/**
 * Publicación de Instagram incrustada. Si Instagram la bloquea (a veces redirige al login, que no se deja
 * incrustar, y el navegador muestra "rechazó la conexión") aparece encima un botón transparente que abre
 * la publicación en Instagram. Solo en ese caso: las que cargan bien no se tocan.
 *
 * Cómo se sabe: el embed de Instagram, cuando carga, le manda avisos a la página (LOADING, MEASURE, MOUNTED,
 * los mismos que escucha su embed.js oficial). Si el iframe terminó de cargar y no llegó ninguno, está roto.
 */
export function InstagramPost({ post, title }: { post: string; title: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  // El iframe se crea recién en el navegador: así el aviso de Instagram no puede llegar antes de que lo escuchemos
  const [src, setSrc] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    setBroken(false);
    // Ancho de referencia para Instagram; si todavía no hay estilos aplicados se usa el de su embed.js
    const width = box.clientWidth >= 200 ? box.clientWidth : 540;
    setSrc(
      instagramEmbedSrc(post, {
        width,
        origin: window.location.origin,
        path: window.location.pathname + window.location.search,
      }),
    );
  }, [post]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!src || !frame) return;
    let alive = false;
    let loadTimer: number | undefined;
    let visibleTimer: number | undefined;
    const markBrokenUnlessAlive = () => {
      if (!alive) setBroken(true);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || !isInstagramEmbedMessage(e.origin, e.data)) return;
      alive = true;
      window.clearTimeout(loadTimer);
      window.clearTimeout(visibleTimer);
      setBroken(false);
    };
    const onLoad = () => {
      if (alive) return;
      window.clearTimeout(loadTimer);
      loadTimer = window.setTimeout(markBrokenUnlessAlive, GRACE_MS);
    };
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      if (!alive) visibleTimer = window.setTimeout(markBrokenUnlessAlive, VISIBLE_TIMEOUT_MS);
    });
    window.addEventListener("message", onMessage);
    frame.addEventListener("load", onLoad);
    observer.observe(frame);
    return () => {
      window.removeEventListener("message", onMessage);
      frame.removeEventListener("load", onLoad);
      observer.disconnect();
      window.clearTimeout(loadTimer);
      window.clearTimeout(visibleTimer);
    };
  }, [src]);

  return (
    <div ref={boxRef} className="relative">
      {src ? (
        <iframe
          ref={frameRef}
          src={src}
          title={title}
          loading="lazy"
          scrolling="no"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="strict-origin-when-cross-origin"
          className={frameClass}
        />
      ) : (
        <div aria-hidden className={frameClass} />
      )}
      {broken && (
        <a
          href={post}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${title}: ver en Instagram`}
          className="absolute inset-0 flex items-center justify-center rounded-2xl bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-5 py-2.5 text-sm font-bold text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-white/80">
            <InstagramLogo size={18} weight="bold" aria-hidden /> Ver en Instagram
          </span>
        </a>
      )}
    </div>
  );
}
