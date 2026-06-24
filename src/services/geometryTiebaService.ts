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

const GEOMETRY_TIEBA_DATA_URL =
  'https://raw.githubusercontent.com/ForeverHaibara/cjhb_data/master/cjhb_data/cjhb_data.jsonl';

let geometryTiebaCache: GeometryTiebaPost[] | null = null;

const normalizeRow = (row: GeometryTiebaJsonlRow): GeometryTiebaPost => ({
  tid: String(row[0] ?? '').trim(),
  title: String(row[1] ?? ''),
  author: String(row[2] ?? ''),
  text: String(row[3] ?? ''),
  createTime: String(row[4] ?? ''),
  replyNum: Number(row[5] ?? 0),
});

export const fetchGeometryTiebaPosts = async (): Promise<GeometryTiebaPost[]> => {
  if (geometryTiebaCache) {
    return geometryTiebaCache;
  }

  const response = await fetch(GEOMETRY_TIEBA_DATA_URL, {
    headers: {
      Accept: 'text/plain,application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load dataset (${response.status})`);
  }

  const rawText = await response.text();
  const posts = rawText
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

  geometryTiebaCache = posts;
  return posts;
};
