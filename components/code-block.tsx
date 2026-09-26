'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { codeHighlighter } from '@/lib/blog/highlight';
import {
  codeLanguages,
  normalizeCodeLanguage,
} from '@/lib/blog/code-languages';

type HighlightNode = {
  type: string;
  value?: string;
  properties?: { className?: unknown };
  children?: HighlightNode[];
};
function tokens(nodes: HighlightNode[]): ReactNode {
  return nodes.map((node, index) =>
    node.type === 'text' ? (
      node.value
    ) : (
      <span
        key={index}
        className={
          Array.isArray(node.properties?.className)
            ? node.properties.className.join(' ')
            : undefined
        }
      >
        {tokens(node.children ?? [])}
      </span>
    ),
  );
}
export function CodeBlock({
  text,
  language,
}: {
  text: string;
  language?: string;
}) {
  const normalized = normalizeCodeLanguage(language);
  const highlighted = useMemo(
    () => tokens(codeHighlighter.highlight(normalized, text).children),
    [normalized, text],
  );
  const [message, setMessage] = useState('复制');
  async function copy() {
    try {
      if (navigator.clipboard && window.isSecureContext)
        await navigator.clipboard.writeText(text);
      else {
        const input = document.createElement('textarea');
        input.value = text;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        // HTTP previews lack the async Clipboard API; keep this legacy fallback only for them.
        // oxlint-disable-next-line typescript/no-deprecated
        const ok = document.execCommand('copy');
        input.remove();
        if (!ok) throw new Error('copy');
      }
      setMessage('已复制');
    } catch {
      setMessage('请手动选择复制');
    }
  }
  return (
    <div className="code-block">
      <span className="code-language">
        {codeLanguages.find(([key]) => key === normalized)?.[1]}
      </span>
      <button type="button" onClick={copy} aria-label="复制代码">
        {message}
      </button>
      <pre>
        <code className={`language-${normalized}`}>{highlighted}</code>
      </pre>
    </div>
  );
}
