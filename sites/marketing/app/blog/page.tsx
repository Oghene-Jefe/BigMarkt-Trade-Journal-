import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Trading Insights",
  description:
    "Guides on forex trading journals, prop firm strategies, gold trading, and performance tracking. From the BigMarkt team.",
  alternates: { canonical: "/blog" },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12">
          <div className="mb-3 font-mono text-xs uppercase tracking-widest text-[#C9A84C]">
            Trading Insights
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            Journal. Learn. Perform.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            Guides and analysis on trading journals, verified performance, prop firms, and the
            habits that separate consistent traders from the rest.
          </p>
        </div>

        {posts.length === 0 ? (
          <p className="text-sm text-white/50">No posts yet. Check back soon.</p>
        ) : (
          <ul className="space-y-8">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block border border-[#1f1f1f] bg-[#111111] p-8 transition hover:border-[#C9A84C]/50"
                >
                  <div className="mb-3 flex items-center gap-4 text-xs text-white/40">
                    <span>{fmtDate(post.date)}</span>
                    <span>·</span>
                    <span>{post.readingTime} min read</span>
                  </div>
                  <h2 className="text-xl font-semibold text-white group-hover:text-[#C9A84C] transition-colors">
                    {post.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-white/60">{post.excerpt}</p>
                  <div className="mt-5 text-xs font-semibold uppercase tracking-wider text-[#C9A84C]">
                    Read more →
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
