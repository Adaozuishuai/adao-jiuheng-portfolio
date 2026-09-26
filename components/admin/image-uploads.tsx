'use client';

import { Node, type Editor, type JSONContent } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react';
import type { EditorDocument } from '@/lib/blog/types';
import { FOCUS_IMAGE_CAPTION_EVENT } from './captioned-image';

const placeholderName = 'imageUpload';

export function hasImageUploads(editor: Editor) {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.type.name === placeholderName) found = true;
  });
  return found;
}

// Upload placeholders are editor-only state, never part of a draft or revision.
export function savedDocument(document: JSONContent): EditorDocument {
  function clean(node: JSONContent): JSONContent {
    return {
      ...node,
      ...(node.content
        ? {
            content: node.content
              .filter((child) => child.type !== placeholderName)
              .map(clean),
          }
        : {}),
    };
  }
  const result = clean(document);
  if (!result.content?.length) result.content = [{ type: 'paragraph' }];
  return result as EditorDocument;
}

function UploadView({ node, editor, getPos, extension }: ReactNodeViewProps) {
  const failed = node.attrs.status === 'failed';
  const available = extension.options.available(node.attrs.id);
  return (
    <NodeViewWrapper
      className="image-upload-placeholder"
      contentEditable={false}
      data-upload-id={node.attrs.id}
    >
      <output>
        {!available
          ? '临时图片已失效，请移除后重新选择'
          : failed
            ? node.attrs.error
            : '图片上传中…'}{' '}
        · {node.attrs.name}
      </output>
      <div>
        {failed && available && (
          <button
            type="button"
            onClick={() => extension.options.retry(node.attrs.id)}
          >
            重试上传
          </button>
        )}
        <button
          type="button"
          aria-label="移除待上传图片"
          onClick={() => {
            const pos = getPos();
            if (typeof pos === 'number')
              editor.commands.deleteRange({
                from: pos,
                to: pos + node.nodeSize,
              });
          }}
        >
          移除
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export const ImageUploadPlaceholder = Node.create<{
  retry: (id: string) => void;
  available: (id: string) => boolean;
}>({
  name: placeholderName,
  group: 'block',
  atom: true,
  selectable: true,
  addOptions() {
    return { retry: () => {}, available: () => false };
  },
  addAttributes() {
    return {
      id: { default: '' },
      name: { default: '' },
      status: { default: 'pending' },
      error: { default: '' },
    };
  },
  // No parseHTML rule: pasted HTML cannot create or resurrect an upload task.
  renderHTML() {
    return ['div', { 'data-image-upload': '' }, '图片上传中'];
  },
  addNodeView() {
    return ReactNodeViewRenderer(UploadView);
  },
});

type UploadTask = {
  id: string;
  file: File;
  caption: boolean;
  status: 'queued' | 'uploading' | 'failed';
  controller?: AbortController;
};

export class ImageUploadQueue {
  private tasks = new Map<string, UploadTask>();
  private active = 0;
  available(id: string) {
    return this.tasks.has(id);
  }
  constructor(
    private editor: () => Editor | null,
    private postId: () => string,
    private notice: (message: string) => void,
  ) {}

  private position(id: string) {
    let result: number | undefined;
    this.editor()?.state.doc.descendants((node, pos) => {
      if (node.type.name === placeholderName && node.attrs.id === id)
        result = pos;
    });
    return result;
  }

  enqueue(files: File[], position?: number, caption = false) {
    const editor = this.editor();
    if (!editor || !editor.isEditable || !files.length) return;
    const pos = position ?? editor.state.selection.from;
    if (editor.state.doc.resolve(pos).parent.type.spec.code) {
      this.notice('请先移到代码块外，再插入图片。');
      return;
    }
    const tasks = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      caption: caption && files.length === 1,
      status: 'queued' as const,
    }));
    for (const task of tasks) this.tasks.set(task.id, task);
    const inserted = editor.commands.insertContentAt(
      position ?? {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      },
      tasks.map((task) => ({
        type: placeholderName,
        attrs: {
          id: task.id,
          name: task.file.name || '剪贴板图片',
          status: 'pending',
        },
      })),
      { updateSelection: false },
    );
    if (!inserted) {
      for (const task of tasks) this.tasks.delete(task.id);
      this.notice('当前位置不能插入图片，请移到正文段落重试。');
      return;
    }
    this.drain();
  }

  sync() {
    for (const [id, task] of this.tasks) {
      if (this.position(id) === undefined) {
        task.controller?.abort();
        this.tasks.delete(id);
      }
    }
  }

  retry(id: string) {
    const task = this.tasks.get(id);
    if (!task) {
      this.notice('临时图片已失效，请移除后重新选择图片。');
      return;
    }
    if (task.status !== 'failed') return;
    task.status = 'queued';
    this.update(id, { status: 'pending', error: '' });
    this.drain();
  }

  private update(id: string, attrs: Record<string, string>) {
    const editor = this.editor(),
      pos = this.position(id);
    if (!editor || editor.isDestroyed || pos === undefined) return;
    const node = editor.state.doc.nodeAt(pos)!;
    editor.view.dispatch(
      editor.state.tr
        .setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs })
        .setMeta('addToHistory', false),
    );
  }

  private drain() {
    for (const task of this.tasks.values()) {
      if (this.active >= 2) break;
      if (task.status !== 'queued') continue;
      task.status = 'uploading';
      this.active++;
      void this.run(task).finally(() => {
        this.active--;
        this.drain();
      });
    }
  }

  private async run(task: UploadTask) {
    task.controller = new AbortController();
    try {
      if (!task.file.size || task.file.size > 10 * 1024 * 1024)
        throw new Error('图片不能超过 10MB，也不能为空');
      if (
        task.file.type &&
        !['image/jpeg', 'image/png', 'image/webp'].includes(task.file.type)
      )
        throw new Error('请选择 JPEG、PNG 或 WebP 图片');
      const form = new FormData();
      form.set('file', task.file);
      form.set('postId', this.postId());
      form.set('alt', '');
      const response = await fetch('/api/admin/assets', {
        method: 'POST',
        body: form,
        signal: task.controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '图片上传失败');
      const editor = this.editor(),
        pos = this.position(task.id);
      if (
        !editor ||
        editor.isDestroyed ||
        pos === undefined ||
        !this.tasks.has(task.id)
      )
        return;
      const node = editor.state.doc.nodeAt(pos)!;
      const image = editor.schema.nodes.image.create({
        src: result.src,
        alt: '',
      });
      editor.view.dispatch(
        editor.state.tr
          .replaceWith(pos, pos + node.nodeSize, image)
          .setMeta('addToHistory', false),
      );
      this.tasks.delete(task.id);
      if (task.caption)
        window.setTimeout(
          () =>
            window.dispatchEvent(
              new CustomEvent(FOCUS_IMAGE_CAPTION_EVENT, {
                detail: result.src,
              }),
            ),
          0,
        );
    } catch (error) {
      if (task.controller.signal.aborted || !this.tasks.has(task.id)) return;
      task.status = 'failed';
      this.update(task.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : '图片上传失败，请重试',
      });
    }
  }

  dispose() {
    for (const task of this.tasks.values()) task.controller?.abort();
    this.tasks.clear();
  }
}

export function clipboardFiles(data: DataTransfer): File[] {
  const files = Array.from(data.files);
  return files.length
    ? files
    : Array.from(data.items)
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));
}

export function cleanPastedHtml(
  html: string,
  notify: (message: string) => void,
): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const images = parsed.querySelectorAll('img, picture, svg');
  if (images.length)
    notify('粘贴内容中的外部图片未导入，请通过截图粘贴或选择文件补传。');
  images.forEach((image) => image.remove());
  parsed
    .querySelectorAll('script, style, iframe, object, embed')
    .forEach((node) => node.remove());
  parsed.querySelectorAll('h1,h4,h5,h6').forEach((node) => {
    const heading = parsed.createElement(node.tagName === 'H1' ? 'h2' : 'h3');
    heading.append(...node.childNodes);
    node.replaceWith(heading);
  });
  parsed
    .querySelectorAll('[style]')
    .forEach((node) => node.removeAttribute('style'));
  return parsed.body.innerHTML;
}
