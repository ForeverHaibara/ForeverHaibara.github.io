export interface GeometryTiebaPost {
  tid: string;
  title: string;
  author: string;
  text: string;
  createTime: string;
  replyNum: number;
  images: string[];
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

type GeometryTiebaOcrJsonlRow = [imagePath: string, text: string];

const GEOMETRY_TIEBA_DATA_URLS = [
  'https://raw.githubusercontent.com/ForeverHaibara/cjhb_data/master/cjhb_data/cjhb_data.jsonl',
  'https://raw.giteeusercontent.com/foreverhaibara/cjhb_data/raw/master/cjhb_data/cjhb_data.jsonl',
];

const GEOMETRY_TIEBA_OCR_DATA_URLS = [
  'https://raw.githubusercontent.com/ForeverHaibara/cjhb_data/master/cjhb_data/cjhb_data_ocr.jsonl',
  'https://raw.giteeusercontent.com/foreverhaibara/cjhb_data/raw/master/cjhb_data/cjhb_data_ocr.jsonl',
];

let geometryTiebaCache: GeometryTiebaPost[] | null = null;
let geometryTiebaOcrCache: Map<string, string> | null = null;

export const normalizeGeometryTiebaImagePath = (path: string) =>
  path.trim().replace(/\\/g, '/').replace(/^\/+/, '');

const normalizeRow = (row: GeometryTiebaJsonlRow): GeometryTiebaPost => ({
  tid: String(row[0] ?? '').trim(),
  title: String(row[1] ?? ''),
  author: String(row[2] ?? ''),
  text: String(row[3] ?? ''),
  createTime: String(row[4] ?? ''),
  replyNum: Number(row[5] ?? 0),
  images: Array.isArray(row[6]) ? row[6].map((imagePath) => String(imagePath ?? '')) : [],
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
  const FAST_TIMEOUT = 20000;
  const FALLBACK_TIMEOUT = 600000;

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

const parseOcrResults = async (response: Response): Promise<Map<string, string>> => {
  if (!response.ok) {
    throw new Error(`Failed to load OCR dataset (${response.status})`);
  }

  const rawText = await response.text();
  const ocrResults = new Map<string, string>();

  rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      try {
        const parsed = JSON.parse(line) as GeometryTiebaOcrJsonlRow;
        const imagePath = normalizeGeometryTiebaImagePath(String(parsed[0] ?? ''));

        if (imagePath) {
          ocrResults.set(imagePath, String(parsed[1] ?? '').trim());
        }
      } catch {
        throw new Error(`Failed to parse OCR dataset line ${index + 1}`);
      }
    });

  return ocrResults;
};

export const fetchGeometryTiebaOcr = async (): Promise<Map<string, string>> => {
  if (geometryTiebaOcrCache) {
    return geometryTiebaOcrCache;
  }

  const [githubUrl, giteeUrl] = GEOMETRY_TIEBA_OCR_DATA_URLS;
  const FAST_TIMEOUT = 20000;
  const FALLBACK_TIMEOUT = 600000;

  let lastError: Error | null = null;

  for (const url of [githubUrl, giteeUrl]) {
    try {
      const response = await fetchWithTimeout(url, FAST_TIMEOUT);
      const ocrResults = await parseOcrResults(response);
      geometryTiebaOcrCache = ocrResults;
      return ocrResults;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  try {
    const response = await fetchWithTimeout(githubUrl, FALLBACK_TIMEOUT);
    const ocrResults = await parseOcrResults(response);
    geometryTiebaOcrCache = ocrResults;
    return ocrResults;
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
  }

  throw lastError ?? new Error('All OCR data sources failed');
};
