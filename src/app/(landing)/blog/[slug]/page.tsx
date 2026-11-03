import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPostScreen } from "@/front/landing/blog/blog-post-screen";
import { BLOG_POSTS } from "@/front/landing/content";

// Los artículos son fijos (front/landing/content.ts): se generan todos al compilar
export function generateStaticParams() {
  return BLOG_POSTS.map(({ slug }) => ({ slug }));
}

export const dynamicParams = false;

const findPost = (slug: string) => BLOG_POSTS.find((p) => p.slug === slug);

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = findPost((await params).slug);
  if (!post) return { title: "Artículo no encontrado" };
  return { title: post.title, description: post.excerpt, openGraph: { images: [post.image] } };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = findPost((await params).slug);
  if (!post) notFound();
  return <BlogPostScreen post={post} />;
}
