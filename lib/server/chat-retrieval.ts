import 'server-only';
import { listPublished } from './posts';
import { projects, projectVisuals } from '@/lib/content';
import type { Source } from '@/lib/chat/types';

function plain(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { text?: string; content?: unknown[]; type?: string };
  return (
    n.text ||
    (n.content || [])
      .map(plain)
      .join(n.type === 'paragraph' || n.type === 'heading' ? '' : '\n')
  );
}
function tokens(text: string) {
  const lower = text.toLowerCase();
  const words = [
    ...new Intl.Segmenter('zh', { granularity: 'word' }).segment(lower),
  ]
    .filter((s) => s.isWordLike)
    .map((s) => s.segment);
  const ngrams = words.flatMap((word) =>
    /^[\p{Script=Han}]{3,}$/u.test(word)
      ? Array.from({ length: word.length - 1 }, (_, i) => word.slice(i, i + 2))
      : [],
  );
  const generic = new Set([
    '你好',
    '请问',
    '请你',
    '请用',
    '介绍',
    '介绍你',
    '一句',
    '句话',
    '一句话',
    '什么',
    '你能',
    '能做',
    '怎么',
    '如何',
    '可以',
    '帮我',
    '说说',
    '聊聊',
    '能做',
    '一下',
    '这个',
    '那个',
    '哪些',
    '有关',
    '关于',
    '主要',
    '内容',
  ]);
  return [...new Set([...words, ...ngrams])]
    .filter((w) => w.length > 1 && !generic.has(w))
    .slice(0, 120);
}
export async function retrieve(
  question: string,
  history: { role: string; content: string }[],
  path: string,
) {
  const terms = tokens(question),
    previous = tokens(
      history
        .filter((m) => m.role === 'user')
        .slice(-2)
        .map((m) => m.content)
        .join(' '),
    );
  const score = (text: string) =>
    terms.reduce((n, t) => n + (text.toLowerCase().includes(t) ? 2 : 0), 0) +
    previous.reduce(
      (n, t) => n + (text.toLowerCase().includes(t) ? 0.3 : 0),
      0,
    );
  const posts = await listPublished();
  const documents = [
    ...posts.map((p) => ({
      title: p.title,
      href: `/blog/${encodeURIComponent(p.slug)}`,
      meta: `博客 文章 ${p.title} ${p.tags.join(' ')} ${p.excerpt}`,
      body: plain(p.content),
    })),
    ...projects.map((p) => ({
      title: p.title,
      href: `/work/${p.id}`,
      meta: `${p.title} ${p.category} ${p.year} 作品 项目`,
      body: `名称：${p.title}；分类：${p.category}；年份：${p.year}；概念视觉：${projectVisuals[p.id].alt}。项目介绍待补充；没有公开技术栈、实施过程或成果数据。`,
    })),
  ];
  const selected = documents
    .map((d) => ({
      ...d,
      score: score(d.meta) * 4 + score(d.body) + (path === d.href ? 20 : 0),
    }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const sources: Source[] = selected.map((d, i) => ({
    id: i + 1,
    title: d.title,
    href: d.href,
  }));
  const context = selected.map((d, i) => {
    const chunks = d.body.match(/[\s\S]{1,700}/g) || [];
    const snippets = chunks
      .map((text, index) => ({ text, index, score: score(text) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .sort((a, b) => a.index - b.index)
      .map((c) => c.text)
      .join('\n[…]\n');
    return {
      source: i + 1,
      title: d.title,
      metadata: d.meta.slice(0, 800),
      snippets,
    };
  });
  return { sources, context };
}
