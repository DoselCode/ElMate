import Image from "next/image";
import Link from "next/link";
import { CaretLeft, ShoppingCartSimple } from "@phosphor-icons/react/dist/ssr";
import type { BlogPost } from "../content";

/** Página de un artículo del blog: foto, título y el texto en párrafos. */
export function BlogPostScreen({ post }: { post: BlogPost }) {
  return (
    <article className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
      <Link href="/#blog" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
        <CaretLeft size={14} weight="bold" aria-hidden /> Volver al blog
      </Link>
      <p className="mt-6 text-sm font-extrabold uppercase tracking-[0.15em] text-primary">{post.tag}</p>
      <h1 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{post.excerpt}</p>
      <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-[var(--radius-card)] bg-primary-soft">
        <Image src={post.image} alt="" fill priority sizes="(min-width: 768px) 48rem, 100vw" className="object-cover" />
      </div>
      <div className="mt-8 space-y-4 leading-relaxed text-foreground">
        {post.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <Link
        href="/tienda"
        className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-white shadow-sm transition-colors hover:bg-primary-hover"
      >
        <ShoppingCartSimple size={18} weight="bold" aria-hidden /> Ver la tienda
      </Link>
    </article>
  );
}
