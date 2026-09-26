'use client';

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react';
import { codeHighlighter } from '@/lib/blog/highlight';
import {
  codeLanguages,
  normalizeCodeLanguage,
} from '@/lib/blog/code-languages';

function CodeBlockView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className="editor-code-block">
      <div className="editor-code-controls" contentEditable={false}>
        <label>
          代码语言{' '}
          <select
            aria-label="代码语言"
            disabled={!editor.isEditable}
            value={normalizeCodeLanguage(node.attrs.language)}
            onChange={(event) =>
              updateAttributes({ language: event.target.value })
            }
          >
            {codeLanguages.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span>Tab 缩进 · 末尾 ↓ 继续写作</span>
      </div>
      <pre>
        <NodeViewContent<'code'> as="code" style={{ whiteSpace: 'pre' }} />
      </pre>
    </NodeViewWrapper>
  );
}

export const HighlightedCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
}).configure({
  lowlight: {
    highlight: codeHighlighter.highlight,
    listLanguages: codeHighlighter.listLanguages,
    registered: codeHighlighter.registered,
    highlightAuto: (text: string) =>
      codeHighlighter.highlight('plaintext', text),
  },
  defaultLanguage: 'plaintext',
  enableTabIndentation: true,
  tabSize: 2,
});
