import React from 'react';
import { Link } from 'react-router-dom';
import { blogPosts } from './blogPosts.ts';

const BlogPage: React.FC = () => {
  return (
    <div className="animate-fadeIn">
      <section className="mb-8 rounded-[32px] border border-white/65 bg-white/58 px-6 py-10 shadow-[0_20px_60px_rgba(148,163,184,0.16)] backdrop-blur-xl sm:px-10">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Notes & ideas</p>
          <h1 className="mb-4 bg-[linear-gradient(135deg,#0f3b73_0%,#2563eb_45%,#38bdf8_100%)] bg-clip-text text-5xl font-semibold tracking-[-0.05em] text-transparent sm:text-6xl">
            Blog
          </h1>
          <p className="text-lg leading-8 text-slate-600">
            A small collection of notes about mathematics, code, experiments, and things I am learning.
          </p>
        </div>

        {blogPosts.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {blogPosts.map((post) => (
              <article
                key={post.slug}
                className="group flex h-full flex-col rounded-[28px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(239,246,255,0.72))] p-6 shadow-[0_16px_40px_rgba(148,163,184,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(96,165,250,0.18)]"
              >
                <div className="mb-4 flex items-center justify-between gap-4 text-sm text-slate-500">
                  <time dateTime={post.date}>{post.date}</time>
                  {post.tags.length > 0 && <span className="truncate text-sky-600">{post.tags.join(' · ')}</span>}
                </div>
                <h2 className="mb-3 text-2xl font-semibold tracking-[-0.03em] text-sky-950 transition-colors group-hover:text-sky-700">
                  {post.title}
                </h2>
                <p className="mb-6 flex-1 leading-7 text-slate-600">{post.summary}</p>
                <Link
                  to={`/blog/${post.slug}`}
                  className="inline-flex w-fit items-center rounded-full bg-[linear-gradient(135deg,#1d4ed8_0%,#38bdf8_100%)] px-4 py-2 text-sm font-medium text-white shadow-[0_10px_22px_rgba(59,130,246,0.2)] transition-all duration-300 hover:translate-x-1"
                >
                  Read article <span className="ml-2" aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-sky-200 bg-sky-50/60 p-8 text-center text-slate-600">
            No posts yet. Add a `.md` file to `src/assets/markdown/blog/` to publish your first article.
          </div>
        )}
      </section>

      <div className="rounded-[24px] border border-white/70 bg-white/48 px-6 py-5 text-sm leading-7 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <span className="font-semibold text-sky-800">Markdown powered.</span> Add a file with frontmatter such as
        <code className="mx-1 rounded-lg bg-sky-50 px-2 py-1 font-mono text-sky-900">title</code>,
        <code className="mx-1 rounded-lg bg-sky-50 px-2 py-1 font-mono text-sky-900">date</code>, and
        <code className="mx-1 rounded-lg bg-sky-50 px-2 py-1 font-mono text-sky-900">summary</code> to maintain the blog in plain text.
      </div>
    </div>
  );
};

export default BlogPage;

