export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  content: string;
}

const markdownModules = import.meta.glob('/src/assets/markdown/blog/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const frontmatterPattern = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/;

const unquote = (value: string) => {
  const trimmedValue = value.trim();
  if (
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1);
  }
  return trimmedValue;
};

const parseTags = (value: string) => {
  const normalizedValue = value.trim().replace(/^\[|\]$/g, '');
  if (!normalizedValue) return [];
  return normalizedValue
    .split(',')
    .map((tag) => unquote(tag))
    .filter(Boolean);
};

const parsePost = (filePath: string, rawMarkdown: string): BlogPost => {
  const frontmatterMatch = rawMarkdown.match(frontmatterPattern);
  const attributes: Record<string, string> = {};

  if (frontmatterMatch?.[1]) {
    for (const line of frontmatterMatch[1].split(/\r?\n/)) {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) continue;
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1);
      attributes[key] = unquote(value);
    }
  }

  const content = frontmatterMatch ? rawMarkdown.slice(frontmatterMatch[0].length) : rawMarkdown;
  const slug = filePath.split('/').pop()?.replace(/\.md$/, '') ?? filePath;
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();

  return {
    slug,
    title: attributes.title || heading || slug,
    date: attributes.date || '未注明日期',
    summary: attributes.summary || '记录一些想法、实验和正在进行的工作。',
    tags: attributes.tags ? parseTags(attributes.tags) : [],
    content,
  };
};

export const blogPosts = Object.entries(markdownModules)
  .map(([filePath, rawMarkdown]) => parsePost(filePath, rawMarkdown))
  .sort((firstPost, secondPost) => secondPost.date.localeCompare(firstPost.date));

export const getBlogPost = (slug: string | undefined) => blogPosts.find((post) => post.slug === slug);
