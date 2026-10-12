import { createHash } from 'node:crypto';
import type { AiToc, EditorDocument } from './types';
import { nodeText } from './document';

export function documentHash(document: EditorDocument) {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, canonical(item)]),
      );
    return value;
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical(document)))
    .digest('hex');
}

export function readableBlocks(document: EditorDocument) {
  return (document.content ?? []).flatMap((node, index) => {
    if (
      ![
        'paragraph',
        'heading',
        'blockquote',
        'bulletList',
        'orderedList',
      ].includes(node.type)
    )
      return [];
    const text = nodeText(node).trim();
    return text ? [{ index, text }] : [];
  });
}

export function parseAiToc(
  value: unknown,
  document: EditorDocument,
): AiToc | null {
  if (value == null) return null;
  if (!value || typeof value !== 'object') throw new Error('目录格式无效');
  const raw = value as { sourceHash?: unknown; items?: unknown };
  if (
    raw.sourceHash !== documentHash(document) ||
    !Array.isArray(raw.items) ||
    raw.items.length > 12
  )
    throw new Error('目录与当前正文不匹配');
  const valid = new Set(readableBlocks(document).map((block) => block.index));
  let previous = -1;
  const items = raw.items.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('目录格式无效');
    const entry = item as { title?: unknown; blockIndex?: unknown };
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    if (
      !title ||
      title.length > 80 ||
      !Number.isInteger(entry.blockIndex) ||
      !valid.has(entry.blockIndex as number) ||
      (entry.blockIndex as number) <= previous
    )
      throw new Error('目录条目无法定位正文');
    previous = entry.blockIndex as number;
    return { title, blockIndex: previous };
  });
  return items.length ? { sourceHash: raw.sourceHash as string, items } : null;
}
