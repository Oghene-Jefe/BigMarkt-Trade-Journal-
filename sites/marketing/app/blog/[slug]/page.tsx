import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllPosts, getPostBySlug } from "@/lib/posts";

type Props = { params: Promise<{ slug: string }> };

// Static map so the bundler can resolve all TSX content components at build time.
const POST_MODULES: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "best-trading-journal-2026": () =>
    import("@/content/posts/best-trading-journal-2026"),
  "xauusd-gold-trading-journal": () =>
    import("@/content/posts/xauusd-gold-trading-journal"),
  "prop-firm-trading-journal": () =>
    import("@/content/posts/prop-firm-trading-journal"),
};

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `/blog/${slug}`,
      type: "article",
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const loader = POST_MODULES[slug];
  if (!loader) notFound();
  const { default: PostContent } = await loader();

  return (
    <article className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/blog"
          className="mb-10 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#C9A84C] hover:underline"
        >
          ← All posts
        </Link>

        <header className="mb-12">
          <div className="mb-4 flex items-center gap-4 text-xs text-white/40">
            <span>{fmtDate(post.date)}</span>
            <span>·</span>
            <span>{post.readingTime} min read</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            {post.title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/60">{post.excerpt}</p>
        </header>

        <div className="prose-blog">
          <PostContent />
        </div>

        <div className="mt-16 border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-8">
          <div className="mb-2 font-mono text-xs uppercase tracking-widest text-[#C9A84C]">
            Start for free
          </div>
          <h2 className="text-2xl font-bold text-white">
            Track your trades on BigMarkt
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Auto-capture every trade from MT4/MT5. Build a verified performance record.
            Follow top traders. Free to start.
          </p>
          <a
            href="https://journal.bigmarkt.co/signup"
            target="_blank"
            rel="noopener"
            className="mt-6 inline-block bg-[#C9A84C] px-8 py-3 text-sm font-semibold uppercase tracking-wider text-black transition hover:bg-[#d8b955]"
          >
            Start your free journal →
          </a>
        </div>
      </div>
    </article>
  );
}
