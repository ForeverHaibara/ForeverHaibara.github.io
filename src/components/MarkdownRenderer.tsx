import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import KatexDisplay, { type KatexDisplayProps } from './KatexDisplay.tsx';

interface MarkdownRendererProps {
  markdownContent: string;
  className?: string;
}

interface CustomCodeComponentProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

interface MathNode {
  type: 'math' | 'inlineMath';
  value: string;
}

interface MathRendererCmpProps {
  node: MathNode;
  inline?: boolean;
  children?: React.ReactNode;
  [key: string]: any;
}

interface PreChildProps {
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ markdownContent, className }) => {
  const customComponents: Components & {
    math?: (props: MathRendererCmpProps) => React.JSX.Element;
    inlineMath?: (props: MathRendererCmpProps) => React.JSX.Element;
  } = {
    h1: ({node, ...props}) => <h1 className="mb-5 mt-1 text-3xl font-semibold tracking-[-0.04em] text-sky-900 sm:text-4xl" {...props} />,
    h2: ({node, ...props}) => <h2 className="mb-3 mt-8 border-b border-sky-100 pb-2 text-2xl font-semibold text-sky-800" {...props} />,
    h3: ({node, ...props}) => <h3 className="mb-2 mt-5 text-xl font-semibold text-sky-700" {...props} />,
    h4: ({node, ...props}) => <h4 className="mb-1 mt-4 text-lg font-semibold text-slate-900" {...props} />,

    p: ({ node, children, ...props }) => {
      const childrenArray = React.Children.toArray(children);
      let containsBlockElement = false;

      for (const child of childrenArray) {
        if (React.isValidElement(child) && child.type === KatexDisplay) {
          const katexProps = child.props as KatexDisplayProps;
          if (katexProps.isBlockMode !== false) {
            containsBlockElement = true;
            break;
          }
        }
      }

      if (containsBlockElement) {
        return <div className="mb-4" {...props}>{children}</div>;
      }

      return <p className="mb-4 leading-8 text-slate-700" {...props}>{children}</p>;
    },

    a: ({node, ...props}) => <a className="text-sky-700 underline decoration-sky-200 underline-offset-4 transition-colors hover:text-sky-900" {...props} />,
    ul: ({node, ...props}) => <ul className="mb-4 list-disc pl-6 text-slate-700" {...props} />,
    ol: ({node, ...props}) => <ol className="mb-4 list-decimal pl-6 text-slate-700" {...props} />,
    li: ({node, ...props}) => <li className="mb-1 leading-7" {...props} />,

    code: ({ node, inline: isReactMarkdownInline, className: langClassNameFromMarkdown, children, ...htmlProps }: CustomCodeComponentProps) => {
      const { className: additionalClassNameFromAttrs, ...restHtmlProps } = htmlProps;
      const combinedClassName = [langClassNameFromMarkdown, additionalClassNameFromAttrs].filter(Boolean).join(' ');
      const rawContent = String(children);
      const trimmedContent = rawContent.trim();
      const isMath = combinedClassName?.includes('language-math');

      if (isMath) {
        let determinedIsBlockMode: boolean;

        if (typeof isReactMarkdownInline === 'boolean') {
          determinedIsBlockMode = !isReactMarkdownInline;
        } else if (rawContent.length > 0 && rawContent !== trimmedContent && rawContent.startsWith(' ') && rawContent.endsWith(' ')) {
          determinedIsBlockMode = true;
        } else {
          const isDisplayClass = combinedClassName.includes('math-display');
          determinedIsBlockMode = isDisplayClass;
          if (combinedClassName.includes('math-inline') && !isDisplayClass) {
            determinedIsBlockMode = false;
          }
        }

        return <KatexDisplay latex={trimmedContent} isBlockMode={determinedIsBlockMode} />;
      }

      if (isReactMarkdownInline) {
        const baseInlineClasses = ['rounded-full', 'bg-sky-50', 'px-2', 'py-1', 'text-sm', 'font-mono', 'text-sky-900', 'mx-0.5', 'break-words'];
        return <code className={[...baseInlineClasses, combinedClassName].filter(Boolean).join(' ')} {...restHtmlProps}>{children}</code>;
      }

      return <code className={combinedClassName} {...restHtmlProps}>{children}</code>;
    },

    pre: ({ node, children, ...props }) => {
      const childArray = React.Children.toArray(children);
      if (childArray.length === 1) {
        const child = childArray[0] as React.ReactElement<PreChildProps>;
        if (child && child.props && (child.props.className?.includes('language-math') || child.type === KatexDisplay)) {
          return <div className="my-4">{children}</div>;
        }
      }
      return (
        <pre className="my-4 overflow-x-auto rounded-[24px] border border-white/80 bg-white/78 p-4 text-sm shadow-[0_12px_28px_rgba(148,163,184,0.1)]" {...props}>
          {children}
        </pre>
      );
    },

    strong: ({node, ...props}) => <strong className="font-semibold text-slate-900" {...props} />,
    table: ({node, ...props}) => <table className="my-6 min-w-full rounded-[24px] border border-sky-100 text-sm shadow-[0_12px_30px_rgba(148,163,184,0.1)]" {...props} />,
    thead: ({node, ...props}) => <thead className="bg-[rgba(239,246,255,0.72)]" {...props} />,
    th: ({node, ...props}) => <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500" {...props} />,
    tbody: ({node, ...props}) => <tbody className="divide-y divide-sky-100 bg-white/80" {...props} />,
    td: ({node, ...props}) => <td className="align-top px-4 py-3 text-slate-700" {...props} />,
    blockquote: ({node, ...props}) => <blockquote className="my-4 rounded-r-[20px] border-l-4 border-sky-300 bg-sky-50/70 px-4 py-3 italic text-slate-700" {...props} />,
    hr: ({node, ...props}) => <hr className="my-8 border-sky-100" {...props} />,
    dt: ({node, ...props}) => <dt className="mt-3 font-semibold text-slate-900" {...props} />,
    dd: ({node, ...props}) => <dd className="mb-2 ml-4 text-slate-600" {...props} />,

    math: ({ node, children }: MathRendererCmpProps) => {
      const latexValue = node?.value || String(children || '').trim();
      if (typeof latexValue !== 'string' || latexValue.length === 0) {
        return <span className="text-red-500">[Error rendering math block: Invalid Node or empty value]</span>;
      }
      return <KatexDisplay latex={latexValue} isBlockMode={true} className="my-2" />;
    },
    inlineMath: ({ node, children }: MathRendererCmpProps) => {
      const latexValue = node?.value || String(children || '').trim();
      if (typeof latexValue !== 'string' || latexValue.length === 0) {
        return <span className="text-red-500">[Error rendering inline math: Invalid Node or empty value]</span>;
      }
      return <KatexDisplay latex={latexValue} isBlockMode={false} />;
    },
  };

  return (
    <div className={`prose max-w-none text-[1.02rem] prose-headings:max-w-none prose-p:max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
        ]}
        components={customComponents}
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
