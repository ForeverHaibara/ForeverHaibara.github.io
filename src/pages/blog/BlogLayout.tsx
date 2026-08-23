import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { blogPosts } from './blogPosts.ts';

const blogNavLinkClasses = ({ isActive }: { isActive: boolean }) =>
  `block rounded-2xl px-3 py-2.5 text-sm transition-all duration-300 ${
    isActive
      ? 'bg-[linear-gradient(135deg,#dbeafe_0%,#eff6ff_100%)] text-sky-800 shadow-[0_8px_20px_rgba(96,165,250,0.14)]'
      : 'text-slate-600 hover:bg-white/70 hover:text-sky-700'
  }`;

const BlogLayout: React.FC = () => {
  return (
    <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 px-4 sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-8">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[28px] border border-white/70 bg-white/58 p-4 shadow-[0_18px_40px_rgba(148,163,184,0.12)] backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between px-2">
                <h2 className="text-lg font-semibold text-slate-800">Blog Menu</h2>
                <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-600">{blogPosts.length}</span>
              </div>
              <nav className="space-y-1" aria-label="Blog navigation">
                <NavLink to="/blog" end className={blogNavLinkClasses}>
                  All posts
                </NavLink>
                <div className="mt-3 space-y-1 border-l border-sky-100 pl-3">
                  {blogPosts.map((post) => (
                    <NavLink key={post.slug} to={`/blog/${post.slug}`} className={blogNavLinkClasses}>
                      <span className="block truncate font-medium">{post.title}</span>
                      <time className="mt-1 block text-xs text-slate-400" dateTime={post.date}>{post.date}</time>
                    </NavLink>
                  ))}
                </div>
              </nav>
            </div>
          </aside>

          <main className="min-w-0">
            <div
              className="rounded-[30px] border border-white/70 px-5 py-6 shadow-[0_20px_50px_rgba(148,163,184,0.12)] backdrop-blur-xl sm:px-7 sm:py-8 xl:px-10"
              style={{
                background: 'linear-gradient(180deg, rgba(219,234,254,0.72) 0px, rgba(239,246,255,0.78) 150px, rgba(251,253,255,0.94) 280px, rgba(251,253,255,0.94) 100%)',
              }}
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default BlogLayout;
