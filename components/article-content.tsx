import type { ReactNode } from 'react';
import Image from 'next/image';
import type { EditorNode } from '@/lib/blog/types';
import { nodeText, safeHref } from '@/lib/blog/document';
import { CodeBlock } from './code-block';

function renderChildren(node: EditorNode, key: string): ReactNode {
  let content: ReactNode =
    node.text ??
    node.content?.map((child, index) => renderNode(child, `${key}-${index}`));
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') content = <strong>{content}</strong>;
    if (mark.type === 'italic') content = <em>{content}</em>;
    if (mark.type === 'code') content = <code>{content}</code>;
    if (mark.type === 'link' && mark.attrs?.href && safeHref(mark.attrs.href))
      content = (
        <a href={mark.attrs.href} rel="noreferrer">
          {content}
        </a>
      );
  }
  return content;
}

function renderNode(node: EditorNode, key: string): ReactNode {
  const children = renderChildren(node, key);
  switch (node.type) {
    case 'text':
      return <span key={key}>{children}</span>;
    case 'paragraph':
      return <p key={key}>{children}</p>;
    case 'heading':
      return node.attrs?.level === 3 ? (
        <h3 id={`section-${key}`} key={key}>
          {children}
        </h3>
      ) : (
        <h2 id={`section-${key}`} key={key}>
          {children}
        </h2>
      );
    case 'bulletList':
      return <ul key={key}>{children}</ul>;
    case 'orderedList':
      return <ol key={key}>{children}</ol>;
    case 'listItem':
      return <li key={key}>{children}</li>;
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>;
    case 'codeBlock':
      return (
        <CodeBlock
          key={key}
          text={nodeText(node)}
          language={node.attrs?.language}
        />
      );
    case 'image':
      return node.attrs?.src?.startsWith('/api/assets/') ? (
        <figure key={key}>
          <Image
            src={node.attrs.src}
            alt={node.attrs.alt ?? ''}
            width={1600}
            height={1000}
            sizes="(max-width: 800px) 100vw, 760px"
            unoptimized
          />
          {node.attrs.alt?.trim() ? (
            <figcaption>{node.attrs.alt}</figcaption>
          ) : null}
        </figure>
      ) : null;
    case 'hardBreak':
      return <br key={key} />;
    default:
      return <span key={key}>{children}</span>;
  }
}

export function ArticleContent({ document }: { document: EditorNode }) {
  return (
    <div className="article-content">
      {document.content?.map((node, index) => renderNode(node, String(index)))}
    </div>
  );
}
