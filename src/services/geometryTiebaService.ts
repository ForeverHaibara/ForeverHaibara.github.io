export interface GeometryTiebaPost {
  tid: string;
  title: string;
  author: string;
  text: string;
  createTime: string;
  replyNum: number;
}

type GeometryTiebaJsonlRow = [
  tid: string,
  title: string,
  author: string,
  text: string,
  createTime: string,
  replyNum: number,
  images: string[]
];

const GEOMETRY_TIEBA_DATA_URLS = [
  'https://raw.githubusercontent.com/ForeverHaibara/cjhb_data/master/cjhb_data/cjhb_data.jsonl',
  'https://raw.giteeusercontent.com/foreverhaibara/cjhb_data/raw/master/cjhb_data/cjhb_data.jsonl',
];

let geometryTiebaCache: GeometryTiebaPost[] | null = null;

const normalizeRow = (row: GeometryTiebaJsonlRow): GeometryTiebaPost => ({
  tid: String(row[0] ?? '').trim(),
  title: String(row[1] ?? ''),
  author: String(row[2] ?? ''),
  text: String(row[3] ?? ''),
  createTime: String(row[4] ?? ''),
  replyNum: Number(row[5] ?? 0),
});

const fetchWithTimeout = async (
  url: string,
  timeout: number = 10000
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/plain,application/json',
      },
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

const parsePosts = async (response: Response): Promise<GeometryTiebaPost[]> => {
  if (!response.ok) {
    throw new Error(`Failed to load dataset (${response.status})`);
  }

  const rawText = await response.text();
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        const parsed = JSON.parse(line) as GeometryTiebaJsonlRow;
        return normalizeRow(parsed);
      } catch {
        throw new Error(`Failed to parse dataset line ${index + 1}`);
      }
    });
};

export const fetchGeometryTiebaPosts = async (): Promise<GeometryTiebaPost[]> => {
  if (geometryTiebaCache) {
    return geometryTiebaCache;
  }

  const [githubUrl, giteeUrl] = GEOMETRY_TIEBA_DATA_URLS;
  const FAST_TIMEOUT = 10000;
  const FALLBACK_TIMEOUT = 60000;

  let lastError: Error | null = null;

  for (const url of [githubUrl, giteeUrl]) {
    try {
      const response = await fetchWithTimeout(url, FAST_TIMEOUT);
      const posts = await parsePosts(response);
      geometryTiebaCache = posts;
      return posts;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  try {
    const response = await fetchWithTimeout(githubUrl, FALLBACK_TIMEOUT);
    const posts = await parsePosts(response);
    geometryTiebaCache = posts;
    return posts;
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
  }

  throw lastError ?? new Error('All data sources failed');
};