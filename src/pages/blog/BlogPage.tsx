import React from 'react';
import { Link } from 'react-router-dom';
import { blogPosts } from './blogPosts.ts';

const BlogPage: React.FC = () => {
  return (
    <div className="animate-fadeIn">
      <section>
        <div className="mb-10 max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Notes & ideas</p>
          <h1 className="mb-5 pb-2 leading-[1.15] bg-[linear-gradient(135deg,#0f3b73_0%,#2563eb_45%,#38bdf8_100%)] bg-clip-text text-5xl font-semibold tracking-[-0.05em] text-transparent sm:text-6xl">
            Blog
          </h1>
          {/* <p className="text-lg leading-8 text-slate-600">
            Various blogs
          </p> */}
        </div>

        {blogPosts.length > 0 ? (
          <div className="space-y-4">
            {blogPosts.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group block cursor-pointer rounded-[24px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(239,246,255,0.72))] p-5 shadow-[0_14px_34px_rgba(148,163,184,0.11)] transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(224,242,254,0.82))] hover:shadow-[0_20px_44px_rgba(96,165,250,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 sm:p-6"
              >
                <article className="grid items-center gap-4 sm:grid-cols-[120px_minmax(0,1fr)] lg:grid-cols-[130px_minmax(0,1fr)_auto]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    <time dateTime={post.date}>{post.date}</time>
                    {post.tags.length > 0 && <span className="text-sky-600">{post.tags.join(' · ')}</span>}
                  </div>
                  <div className="min-w-0">
                    <h2 className="mb-1 text-2xl font-semibold tracking-[-0.03em] text-sky-950 transition-colors group-hover:text-sky-700">
                      {post.title}
                    </h2>
                    <p className="leading-7 text-slate-600">{post.summary}</p>
                  </div>
                  <span className="hidden text-xl text-sky-400 transition-transform duration-300 group-hover:translate-x-1 lg:block" aria-hidden="true">→</span>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-sky-200 bg-sky-50/60 p-8 text-center text-slate-600">
            No posts yet. Add a `.md` file to `src/assets/markdown/blog/` to publish your first article.
          </div>
        )}
      </section>

      {/* <div className="rounded-[24px] border border-white/70 bg-white/48 px-6 py-5 text-sm leading-7 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <span className="font-semibold text-sky-800">Markdown powered.</span>Add a file with frontmatter such as
        <code className="mx-1 rounded-lg bg-sky-50 px-2 py-1 font-mono text-sky-900">title</code>,
        <code className="mx-1 rounded-lg bg-sky-50 px-2 py-1 font-mono text-sky-900">date</code>, and
        <code className="mx-1 rounded-lg bg-sky-50 px-2 py-1 font-mono text-sky-900">summary</code> to maintain the blog in plain text.
      </div> */}
    </div>
  );
};

export default BlogPage;
