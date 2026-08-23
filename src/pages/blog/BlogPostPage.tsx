import React from 'react';
import { Link, useParams } from 'react-router-dom';
import MarkdownRenderer from '../../components/MarkdownRenderer.tsx';
import { getBlogPost } from './blogPosts.ts';

const BlogPostPage: React.FC = () => {
  const { slug } = useParams();
  const post = getBlogPost(slug);

  if (!post) {
    return (
      <div className="rounded-[32px] border border-white/65 bg-white/58 px-6 py-14 text-center shadow-[0_20px_60px_rgba(148,163,184,0.16)] backdrop-blur-xl sm:px-10">
        <h1 className="text-4xl font-semibold text-sky-900">文章不存在</h1>
        <p className="mt-3 text-slate-600">找不到这篇博客文章。</p>
        <Link to="/blog" className="mt-6 inline-flex rounded-full bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-700">
          返回 Blog
        </Link>
      </div>
    );
  }

  return (
    <article className="rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,rgba(219,234,254,0.72) 0px,rgba(239,246,255,0.78) 170px,rgba(251,253,255,0.95) 360px)] px-5 py-7 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur-xl sm:px-8 sm:py-9 xl:px-12">
      <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-sky-100 pb-5 text-sm text-slate-500">
        <Link to="/blog" className="font-medium text-sky-700 transition-colors hover:text-sky-900">← All posts</Link>
        <span aria-hidden="true">·</span>
        <time dateTime={post.date}>{post.date}</time>
        {post.tags.length > 0 && <span className="text-sky-600">{post.tags.join(' · ')}</span>}
      </div>
      <MarkdownRenderer markdownContent={post.content} />
    </article>
  );
};

export default BlogPostPage;

