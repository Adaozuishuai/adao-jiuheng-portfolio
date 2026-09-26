import type { EditorDocument, EditorNode } from './types';
import { normalizeCodeLanguage } from './code-languages';

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function safeHref(href: string) {
  return (
    /^(https?:\/\/|mailto:)/i.test(href) ||
    /^\/(?!\/)/.test(href) ||
    /^#[\w-]+$/.test(href)
  );
}
export function nodeText(node: EditorNode): string {
  return node.text ?? (node.content ?? []).map(nodeText).join('');
}
export function headings(document: EditorNode) {
  const result: { id: string; title: string; level: number }[] = [];
  function walk(node: EditorNode, key: string) {
    if (node.type === 'heading')
      result.push({
        id: `section-${key}`,
        title: nodeText(node),
        level: node.attrs?.level ?? 2,
      });
    node.content?.forEach((child, i) => walk(child, `${key}-${i}`));
  }
  document.content?.forEach((node, i) => walk(node, String(i)));
  return result;
}
export function imageIds(document: EditorNode): string[] {
  const result: string[] = [];
  function walk(node: EditorNode) {
    if (node.type === 'image') {
      const id = node.attrs?.src?.replace('/api/assets/', '');
      if (id && UUID.test(id)) result.push(id);
    }
    node.content?.forEach(walk);
  }
  walk(document);
  return [...new Set(result)];
}
export function validateDocument(input: unknown): EditorDocument {
  let nodes = 0;
  function visit(value: unknown, depth: number): EditorNode {
    if (++nodes > 15000 || depth > 20 || !value || typeof value !== 'object')
      throw new Error('正文结构无效或过长');
    const node = value as EditorNode;
    const allowed = [
      'doc',
      'paragraph',
      'heading',
      'text',
      'bulletList',
      'orderedList',
      'listItem',
      'blockquote',
      'codeBlock',
      'image',
      'hardBreak',
    ];
    if (!allowed.includes(node.type)) throw new Error('正文包含不支持的格式');
    const clean: EditorNode = { type: node.type };
    if (node.type === 'codeBlock')
      clean.attrs = { language: normalizeCodeLanguage(node.attrs?.language) };
    if (node.type === 'text') {
      if (typeof node.text !== 'string' || node.text.length > 200000)
        throw new Error('文本无效或过长');
      clean.text = node.text;
    }
    if (node.type === 'heading') {
      if (![2, 3].includes(node.attrs?.level ?? 0))
        throw new Error('仅支持二级和三级标题');
      clean.attrs = { level: node.attrs!.level };
    }
    if (node.type === 'image') {
      const src = node.attrs?.src ?? '';
      if (!src.startsWith('/api/assets/') || !UUID.test(src.slice(12)))
        throw new Error('请使用已上传的图片');
      clean.attrs = {
        src,
        alt: String(node.attrs?.alt ?? '')
          .trim()
          .slice(0, 240),
      };
    }
    if (node.marks) {
      if (!Array.isArray(node.marks) || node.marks.length > 4)
        throw new Error('文本样式无效');
      clean.marks = node.marks.map((mark) => {
        if (!['bold', 'italic', 'code', 'link'].includes(mark.type))
          throw new Error('不支持的样式');
        if (mark.type === 'link') {
          const href = mark.attrs?.href;
          if (typeof href !== 'string' || href.length > 2048 || !safeHref(href))
            throw new Error('链接地址无效');
          return { type: 'link', attrs: { href } };
        }
        return { type: mark.type };
      });
    }
    if (node.content) {
      if (!Array.isArray(node.content)) throw new Error('正文结构无效');
      clean.content = node.content.map((child) => visit(child, depth + 1));
    }
    return clean;
  }
  const document = visit(input, 0);
  if (document.type !== 'doc') throw new Error('正文根节点无效');
  return document as EditorDocument;
}
