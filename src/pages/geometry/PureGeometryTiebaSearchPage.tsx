import React, { useEffect, useMemo, useState } from 'react';
import { fetchGeometryTiebaPosts } from '../../services/geometryTiebaService.ts';
import type { GeometryTiebaPost } from '../../services/geometryTiebaService.ts';
import LoadingSpinner from '../../components/LoadingSpinner.tsx';
import AlertMessage from '../../components/AlertMessage.tsx';

type SortKey = 'tid' | 'title' | 'author' | 'createTime' | 'replyNum';
type SortDirection = 'asc' | 'desc';

interface ColumnConfig {
  key: SortKey;
  label: string;
  align?: 'left' | 'right';
  width?: string;
}

const searchFields: (keyof Pick<GeometryTiebaPost, 'title' | 'author' | 'text'>)[] = ['title', 'author', 'text'];

const columns: ColumnConfig[] = [
  { key: 'title', label: 'Post Title' },
  { key: 'author', label: 'Author' },
  { key: 'createTime', label: 'Created', width: '100px' },
  { key: 'replyNum', label: 'Replies', align: 'right', width: '70px' },
  { key: 'tid', label: 'TID', width: '120px' },
];

const PAGE_SIZE = 50;
const heroCardClass = 'relative overflow-hidden rounded-[30px] border border-white/70 bg-white/50 px-5 py-6 shadow-[0_18px_42px_rgba(148,163,184,0.12)] backdrop-blur-xl sm:px-7 sm:py-8';
const panelClass = 'rounded-[30px] border border-white/70 bg-white/62 p-5 shadow-[0_20px_44px_rgba(148,163,184,0.14)] backdrop-blur-xl sm:p-6 lg:p-7';

const tokenizeQuery = (query: string) =>
  query
    .trim()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

const matchesQuery = (post: GeometryTiebaPost, queryTerms: string[], keys: readonly (keyof GeometryTiebaPost)[]) => {
  if (queryTerms.length === 0) {
    return true;
  }

  return queryTerms.every((term) =>
    keys.some((key) => String(post[key] ?? '').toLowerCase().includes(term.toLowerCase()))
  );
};

const comparePosts = (left: GeometryTiebaPost, right: GeometryTiebaPost, sortKey: SortKey, direction: SortDirection) => {
  const multiplier = direction === 'asc' ? 1 : -1;

  if (sortKey === 'tid') {
    const leftTid = BigInt(left.tid);
    const rightTid = BigInt(right.tid);
    if (leftTid === rightTid) {
      return 0;
    }
    return leftTid > rightTid ? multiplier : -multiplier;
  }

  if (sortKey === 'replyNum') {
    return (left.replyNum - right.replyNum) * multiplier;
  }

  return left[sortKey].localeCompare(right[sortKey], undefined, {
    numeric: true,
    sensitivity: 'base',
  }) * multiplier;
};

const PureGeometryTiebaSearchPage: React.FC = () => {
  const [posts, setPosts] = useState<GeometryTiebaPost[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('tid');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    let isMounted = true;

    const loadPosts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const loadedPosts = await fetchGeometryTiebaPosts();
        if (isMounted) {
          setPosts(loadedPosts);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load the dataset.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      isMounted = false;
    };
  }, []);

  const queryTerms = useMemo(() => tokenizeQuery(query), [query]);

  const filteredPosts = useMemo(
    () => posts.filter((post) => matchesQuery(post, queryTerms, searchFields)),
    [posts, queryTerms]
  );

  const sortedPosts = useMemo(() => {
    const next = [...filteredPosts];
    next.sort((left, right) => comparePosts(left, right, sortKey, sortDirection));
    return next;
  }, [filteredPosts, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedPosts.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [query, sortKey, sortDirection]);

  useEffect(() => {
    setCurrentPage((previousPage) => Math.min(previousPage, totalPages));
  }, [totalPages]);

  const paginatedPosts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedPosts.slice(start, start + PAGE_SIZE);
  }, [currentPage, sortedPosts]);

  const toggleSort = (columnKey: SortKey) => {
    if (columnKey === sortKey) {
      setSortDirection((previousDirection) => (previousDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(columnKey);
    setSortDirection(columnKey === 'tid' ? 'desc' : 'asc');
  };

  const pageStart = sortedPosts.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, sortedPosts.length);

  return (
    <div className="space-y-6">
      <section className={heroCardClass}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-32 rounded-full blur-3xl"
          style={{ background: 'linear-gradient(90deg, rgba(125,211,252,0.2), rgba(191,219,254,0.12), rgba(255,255,255,0))' }}
        />
        <div className="relative max-w-4xl">
          {/* <span className="inline-flex rounded-full border border-white/80 bg-white/72 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            Geometry
          </span> */}
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-sky-900 sm:text-4xl">
            Pure Geometry Tieba Search
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            Search the pure geometry Tieba archive in place. The dataset is loaded once from the public repository, then every query, sort action, and page change updates the table below without leaving this page.
          </p>
        </div>
      </section>

      <section className={panelClass}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
          <div>
            <label htmlFor="geometry-search" className="mb-2 block text-sm font-medium text-slate-700">
              Search in title, author, and text
            </label>
            <input
              id="geometry-search"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Enter one or more exact substrings"
              className="w-full rounded-2xl border border-sky-100 bg-white/82 px-4 py-3 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-colors focus:border-sky-300 focus:ring-sky-200"
            />
            <p className="mt-2 text-xs leading-6 text-slate-500">
              Spaces split the query into multiple required terms. Each term must appear in at least one searchable field.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(239,246,255,0.65))] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dataset status</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-sky-900">
              {isLoading ? 'Loading...' : `${posts.length.toLocaleString()} posts`}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {isLoading ? 'Fetching archive data.' : `${sortedPosts.length.toLocaleString()} matching results`}
            </p>
          </div>
        </div>
      </section>

      <section className={panelClass}>
        {error && <AlertMessage type="error" message={error} onClose={() => setError(null)} />}

        {isLoading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-slate-600">
            <LoadingSpinner size="lg" />
            <p>Loading archive data...</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">
                Showing <span className="font-semibold text-slate-800">{pageStart}</span> to{' '}
                <span className="font-semibold text-slate-800">{pageEnd}</span> of{' '}
                <span className="font-semibold text-slate-800">{sortedPosts.length.toLocaleString()}</span> results
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_8px_20px_rgba(148,163,184,0.1)] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <div className="rounded-full border border-white/80 bg-sky-50/80 px-4 py-2 text-sm font-medium text-sky-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                  Page {currentPage} / {totalPages}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_8px_20px_rgba(148,163,184,0.1)] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-[26px] border border-sky-100 shadow-[0_18px_40px_rgba(148,163,184,0.1)]">
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white/82">
                  <thead className="bg-[rgba(239,246,255,0.85)]">
                    <tr>
                      {columns.map((column) => {
                        const isActive = column.key === sortKey;
                        const indicator = isActive ? (sortDirection === 'asc' ? 'ASC ' : 'DESC') : 'SORT';
                        return (
                          <th
                            key={column.key}
                            scope="col"
                            style={column.width ? { width: column.width, minWidth: column.width } : {}}
                            className={`px-4 py-3 ${column.align === 'right' ? 'text-right' : 'text-left'} text-xs font-medium uppercase tracking-wider text-slate-500`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort(column.key)}
                              className={`inline-flex items-center gap-2 rounded-full px-2 py-1 transition-colors ${
                                isActive ? 'bg-white/80 text-sky-800' : 'hover:bg-white/65 hover:text-slate-700'
                              }`}
                            >
                              <span>{column.label}</span>
                              <span aria-hidden="true" className="text-sm">
                                {indicator}
                              </span>
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100/80">
                    {paginatedPosts.map((post) => (
                      <tr key={post.tid} className="transition-colors hover:bg-sky-50/55">
                        <td className="max-w-[420px] px-4 py-4 align-top">
                          <div className="space-y-2">
                            <a
                              href={`https://tieba.baidu.com/p/${post.tid}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-sm font-semibold leading-6 text-sky-800 transition-colors hover:text-sky-600 hover:underline"
                            >
                              {post.title || '(Untitled post)'}
                            </a>
                            {post.text && (
                              <p className="text-xs leading-6 text-slate-500">
                                {post.text.length > 140 ? `${post.text.slice(0, 140)}...` : post.text}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-700">
                          {post.author || 'Unknown'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-slate-700">
                          {post.createTime}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right align-top text-sm text-slate-700">
                          {post.replyNum.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-slate-500">
                          {post.tid}
                        </td>
                      </tr>
                    ))}
                    {paginatedPosts.length === 0 && (
                      <tr>
                        <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-slate-500">
                          No posts match the current query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default PureGeometryTiebaSearchPage;