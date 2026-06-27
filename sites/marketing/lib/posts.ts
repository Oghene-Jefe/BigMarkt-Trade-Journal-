import { POST_METADATA } from "@/content/posts/metadata";

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  keywords: string[];
  readingTime: number;
};

export function getAllPosts(): PostMeta[] {
  return Object.entries(POST_METADATA)
    .map(([slug, meta]) => ({ slug, ...meta }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPostBySlug(slug: string): PostMeta | null {
  const meta = POST_METADATA[slug];
  if (!meta) return null;
  return { slug, ...meta };
}
