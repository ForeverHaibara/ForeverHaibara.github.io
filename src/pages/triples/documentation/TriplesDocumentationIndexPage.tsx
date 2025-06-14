
import React from 'react';
import MarkdownRenderer from '../../../components/MarkdownRenderer.tsx';
import documentationIndexMarkdown from '../../../assets/markdown/triples-documentation/index.md?raw';

const TriplesDocumentationIndexPage: React.FC = () => {
  return (
    <MarkdownRenderer markdownContent={documentationIndexMarkdown} />
  );
};

export default TriplesDocumentationIndexPage;
