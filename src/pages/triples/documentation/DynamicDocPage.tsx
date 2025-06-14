
import React, { useEffect, useState } from 'react';
import { useParams, NavLink } from 'react-router-dom'; 
import MarkdownRenderer from '../../../components/MarkdownRenderer.tsx';
import LoadingSpinner from '../../../components/LoadingSpinner.tsx';

// Eagerly import all markdown files under the documentation directory as raw strings.
// Vite's import.meta.glob is a build-time feature.
const markdownModules: Record<string, string> = import.meta.glob(
  '/src/assets/markdown/triples-documentation/**/*.md', 
  { eager: true, as: 'raw' }
);

// Log all modules captured by glob for debugging.
// console.log('Available markdown modules (from DynamicDocPage):', markdownModules);

const DynamicDocPage: React.FC = () => {
  const params = useParams();
  const docPath = params['*']; // Captures segments like "getting-started" or "api-reference/sum-of-squares"
  
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    setIsLoading(true);
    setError(false);
    setMarkdownContent(null);

    // console.log('[DynamicDocPage] useEffect triggered. All markdownModules keys:', Object.keys(markdownModules));
    // console.log(`[DynamicDocPage] Attempting to load docPath: "${docPath}"`);

    if (!docPath) {
      console.error('[DynamicDocPage] No document path (docPath) provided from useParams(). This usually means the route is not capturing the path segment correctly or the URL is malformed.');
      setError(true);
      setIsLoading(false);
      return;
    }

    // Construct the key for the markdownModules object
    // e.g., if docPath is "getting-started", fullMarkdownPath = "/src/assets/markdown/triples-documentation/getting-started.md"
    // e.g., if docPath is "api-reference/sum-of-squares", fullMarkdownPath = "/src/assets/markdown/triples-documentation/api-reference/sum-of-squares.md"
    const fullMarkdownPath = `/src/assets/markdown/triples-documentation/${docPath}.md`;
    // console.log(`[DynamicDocPage] Constructed fullMarkdownPath to look for: "${fullMarkdownPath}"`);
    
    const content = markdownModules[fullMarkdownPath];

    if (content !== undefined) {
      // console.log(`[DynamicDocPage] Content found for "${fullMarkdownPath}". Length: ${content.length}`);
      setMarkdownContent(content);
    } else {
      console.warn(`[DynamicDocPage] Markdown file not found for constructed path: "${fullMarkdownPath}".`);
      console.warn(`[DynamicDocPage] This means the key "${fullMarkdownPath}" does not exist in the markdownModules object.`);
      console.warn('[DynamicDocPage] Available keys in markdownModules are:', Object.keys(markdownModules));
      setError(true); // Indicates a 404 for the doc
    }
    setIsLoading(false);
  }, [docPath]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner text="Loading documentation..." />
      </div>
    );
  }

  if (error || !markdownContent) {
    return (
      <div className="text-center py-10 px-4">
        <h1 className="text-3xl font-bold text-red-600">Document Not Found</h1>
        <p className="text-slate-700 mt-2">
          The requested documentation page (<code>{docPath}.md</code>) could not be found.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          (Tried to load: <code>/src/assets/markdown/triples-documentation/{docPath}.md</code>)
        </p>
        <p className="mt-4">
          <NavLink to="/triples/documentation" className="text-blue-500 hover:underline">
            Back to Documentation Overview
          </NavLink>
        </p>
      </div>
    );
  }

  return <MarkdownRenderer markdownContent={markdownContent} />;
};

export default DynamicDocPage;
