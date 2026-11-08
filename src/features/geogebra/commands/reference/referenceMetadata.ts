export interface ReferenceMetadata {
  keywords?: string;
  details?: string[];
  examples?: Array<{ command: string; note?: string }>;
  related?: string[];
}

export function validateReferenceMetadata(value: unknown, name: string): void {
  if (value === undefined) return;
  const invalid = () => { throw new Error(`Invalid reference metadata: ${name}`); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !['keywords', 'details', 'examples', 'related'].includes(key))) return invalid();
  if (record.keywords !== undefined && typeof record.keywords !== 'string') return invalid();
  for (const key of ['details', 'related']) {
    const items = record[key];
    if (items !== undefined && (!Array.isArray(items) || items.some((item) => typeof item !== 'string' || !item.trim()))) return invalid();
  }
  if (record.examples !== undefined && (!Array.isArray(record.examples) || record.examples.some((example) =>
    !example || typeof example !== 'object' || Array.isArray(example)
      || Object.keys(example).some((key) => !['command', 'note'].includes(key))
      || typeof example.command !== 'string' || !example.command.trim()
      || example.note !== undefined && typeof example.note !== 'string'))) return invalid();
}
