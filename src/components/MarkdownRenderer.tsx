
import React, { useState } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw'; // For rendering HTML embedded in Markdown
import KatexDisplay, { type KatexDisplayProps } from './KatexDisplay.tsx'; // Import KatexDisplayProps
// Element type from HAST might be used by react-markdown for standard HTML element nodes
import type { Element as HastElement } from 'hast';

interface MarkdownRendererProps {
  markdownContent: string;
  className?: string;
}

// Props for the custom <code> component
interface CustomCodeComponentProps {
  node?: any; 
  inline?: boolean; // Prop from react-markdown: true for `code`, false for ```code```, undefined if not applicable
  className?: string; // This will include "language-xxx" from markdown
  children?: React.ReactNode; 
  [key: string]: any; // Allow other HTML attributes
}

// Props for custom math components
interface MathNode { 
  type: 'math' | 'inlineMath'; 
  value: string; // The LaTeX string
}

interface MathRendererCmpProps {
  node: MathNode;
  inline?: boolean; 
  children?: React.ReactNode; 
  [key: string]: any;
}


const CopyButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
  const [copyStatus, setCopyStatus] = useState('Copy');

  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus('Copy'), 2000);
    }).catch(err => {
      console.error('Failed to copy text:', err);
      setCopyStatus('Failed');
      setTimeout(() => setCopyStatus('Copy'), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 opacity-0 group-hover:opacity-100 focus:opacity-100"
      aria-label="Copy code to clipboard"
    >
      {copyStatus}
    </button>
  );
};


const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ markdownContent, className }) => {
  // console.log('[MarkdownRenderer] Initializing. Markdown content length:', markdownContent.length);

  const customComponents: Components & {
    math?: (props: MathRendererCmpProps) => JSX.Element;
    inlineMath?: (props: MathRendererCmpProps) => JSX.Element;
  } = {
    h1: ({node, ...props}) => <h1 className="text-3xl sm:text-4xl font-bold text-blue-700 mt-8 mb-4 pb-2" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-2xl font-semibold text-blue-700 mt-6 mb-3 border-b border-blue-200 pb-2" {...props} />,
    h3: ({node, ...props}) => <h3 className="text-xl font-semibold text-blue-600 mt-4 mb-2" {...props} />,
    h4: ({node, ...props}) => <h4 className="text-lg font-semibold text-black mt-3 mb-1" {...props} />,
    
    p: ({ node, children, ...props }) => {
      const childrenArray = React.Children.toArray(children);
      let containsBlockElement = false;

      for (const child of childrenArray) {
        if (React.isValidElement(child) && child.type === KatexDisplay) {
          const katexProps = child.props as KatexDisplayProps;
          // KatexDisplay defaults isBlockMode to true if undefined.
          // So, it's block unless explicitly set to false.
          if (katexProps.isBlockMode !== false) {
            containsBlockElement = true;
            break;
          }
        }
      }

      if (containsBlockElement) {
        // If a paragraph would contain a block-level KatexDisplay (which renders a <div>),
        // render this "paragraph" as a <div> instead to avoid p > div nesting.
        // We use mb-4 to mimic the original paragraph's bottom margin for spacing consistency.
        // console.log("[MarkdownRenderer p] Detected child KatexDisplay in block mode. Rendering as <div> instead of <p> to prevent nesting error.");
        return <div className="mb-4" {...props}>{children}</div>;
      }
      
      return <p className="text-black leading-relaxed mb-4" {...props}>{children}</p>;
    },

    a: ({node, ...props}) => <a className="text-blue-600 hover:text-blue-800 hover:underline" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc list-inside mb-4 pl-4 text-black" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-4 pl-4 text-black" {...props} />,
    li: ({node, ...props}) => <li className="mb-1" {...props} />,
    
    code: ({ node, inline: isReactMarkdownInline, className: langClassNameFromMarkdown, children, ...htmlProps }: CustomCodeComponentProps) => {
      const { className: additionalClassNameFromAttrs, ...restHtmlProps } = htmlProps;
      const combinedClassName = [langClassNameFromMarkdown, additionalClassNameFromAttrs].filter(Boolean).join(' ');
      const rawContent = String(children); // Keep raw content for space heuristic
      const trimmedContent = rawContent.trim(); // For KaTeX rendering

      const isMath = combinedClassName?.includes('language-math');

      if (isMath) {
        let determinedIsBlockMode: boolean;
        const rawContentForLog = rawContent.length > 50 ? rawContent.substring(0,50) + "..." : rawContent;

        // console.log(`[MarkdownRenderer CODE] Math content. ReactMarkdown 'inline' prop: ${isReactMarkdownInline}, ClassName: "${combinedClassName}", Raw Content: "${rawContentForLog}"`);

        if (typeof isReactMarkdownInline === 'boolean') {
          determinedIsBlockMode = !isReactMarkdownInline; 
          // console.log(`[MarkdownRenderer CODE] Using 'isReactMarkdownInline' prop (${isReactMarkdownInline}) -> determinedIsBlockMode: ${determinedIsBlockMode}`);
        } else {
          // console.log(`[MarkdownRenderer CODE] 'isReactMarkdownInline' is undefined. Applying custom heuristics on (${trimmedContent.substring(0,50)}...).`);
          
          if (rawContent.length > 0 && rawContent !== trimmedContent && rawContent.startsWith(' ') && rawContent.endsWith(' ')) {
            determinedIsBlockMode = true;
            // console.log(`[MarkdownRenderer CODE] Space heuristic matched (content was wrapped in spaces). determinedIsBlockMode: true`);
          } else {
            const isDisplayClass = combinedClassName.includes('math-display');
            determinedIsBlockMode = isDisplayClass; 

            if (combinedClassName.includes('math-inline') && !isDisplayClass) {
              determinedIsBlockMode = false; 
            }
            // console.log(`[MarkdownRenderer CODE] Space heuristic NOT matched. Fallback class logic: contains('math-display')=${isDisplayClass}, contains('math-inline')=${combinedClassName.includes('math-inline')}. Deduced determinedIsBlockMode: ${determinedIsBlockMode}`);
          }
        }
        return <KatexDisplay latex={trimmedContent} isBlockMode={determinedIsBlockMode} />;
      }
      
      if (isReactMarkdownInline) { 
        const baseInlineClasses = ['bg-slate-200', 'text-slate-800', 'p-1', 'rounded', 'text-sm', 'font-mono', 'mx-0.5', 'break-words'];
        const finalClassName = [...baseInlineClasses, combinedClassName].filter(Boolean).join(' ');
        return <code className={finalClassName} {...restHtmlProps}>{children}</code>;
      }
      
      return (
        <code className={combinedClassName} {...restHtmlProps}>
        {children}
        </code>
        // <div className="relative group markdown-code-block-wrapper" {...restHtmlProps}>
        //   {children}
        //   <CopyButton textToCopy={rawContent} />
        // </div>
      );
    },

    pre: ({ node, children, ...props }) => {
      const childArray = React.Children.toArray(children);
      // Check if the direct child is what our 'code' component produces for highlighted code or math.
      // These children (KatexDisplay or the SyntaxHighlighter wrapper div) handle their own styling.
      if (childArray.length === 1) {
        const child = childArray[0] as React.ReactElement;
        if (child && child.props && (child.props.className?.includes('language-math') || child.type === KatexDisplay)) {
          // Pass through: styling is handled by the child.
          // Add margin that <pre> would typically have.
          return <div className="my-4">{children}</div>;
        }
      }
      return (
        <pre className="bg-slate-100 p-4 rounded-md shadow-sm overflow-x-auto text-sm my-4 border border-slate-200" {...props}>
          {children}
        </pre>
      );
    },

    strong: ({node, ...props}) => <strong className="font-semibold text-slate-800" {...props} />,
    table: ({node, ...props}) => <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-md shadow-sm my-6 text-sm" {...props} />,
    thead: ({node, ...props}) => <thead className="bg-slate-50" {...props} />,
    th: ({node, ...props}) => <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider" {...props} />,
    tbody: ({node, ...props}) => <tbody className="bg-white divide-y divide-slate-200" {...props} />,
    td: ({node, ...props}) => <td className="px-4 py-3 text-black align-top" {...props} />,
    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 text-black italic" {...props} />,
    hr: ({node, ...props}) => <hr className="my-6 border-slate-300" {...props} />,
    dt: ({node, ...props}) => <dt className="font-semibold text-slate-800 mt-3" {...props} />,
    dd: ({node, ...props}) => <dd className="ml-4 text-slate-600 mb-2" {...props} />,
    
    math: ({ node, children, ...props }: MathRendererCmpProps) => { 
        const latexValue = node?.value || String(children || '').trim();
        const latexForLog = latexValue.length > 50 ? latexValue.substring(0,50) + "..." : latexValue;
        // console.log('[MarkdownRenderer MATH component ($$..$$)] Triggered. Using LaTeX:', latexForLog);
        if (typeof latexValue !== 'string' || latexValue.length === 0) {
          // console.error('[MarkdownRenderer MATH component] Invalid Node or empty value for LaTeX:', node);
          return <span className="text-red-500">[Error rendering math block: Invalid Node or empty value]</span>;
        }
        return <KatexDisplay latex={latexValue} isBlockMode={true} className="my-2" />; 
    },
    inlineMath: ({ node, children, ...props }: MathRendererCmpProps) => { 
        const latexValue = node?.value || String(children || '').trim();
        const latexForLog = latexValue.length > 50 ? latexValue.substring(0,50) + "..." : latexValue;
        // console.log('[MarkdownRenderer INLINEMATH component ($..$)] Triggered. Using LaTeX:', latexForLog);
        if (typeof latexValue !== 'string' || latexValue.length === 0) {
          // console.error('[MarkdownRenderer INLINEMATH component] Invalid Node or empty value for LaTeX:', node);
          return <span className="text-red-500">[Error rendering inline math: Invalid Node or empty value]</span>;
        }
        return <KatexDisplay latex={latexValue} isBlockMode={false} />;
    },
  };

  const remarkPlugins = [remarkGfm, remarkMath];
  const rehypePlugins = [rehypeRaw]; 
  
  return (
    <div className={`prose max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={customComponents}
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;