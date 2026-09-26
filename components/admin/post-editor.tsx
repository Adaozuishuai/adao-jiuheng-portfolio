'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from 'next/image';
import Link from 'next/link';
import {
  Bold,
  Check,
  Clock3,
  Code,
  Code2,
  Heading2,
  Heading3,
  History,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  Quote,
  Redo2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type { PostSnapshot, RevisionKind } from '@/lib/blog/types';
import { imageIds, nodeText, safeHref } from '@/lib/blog/document';
import { ArticleContent } from '@/components/article-content';
import { CaptionedImage } from './captioned-image';
import { HighlightedCodeBlock } from './code-block';
import {
  ImageUploadPlaceholder,
  ImageUploadQueue,
  clipboardFiles,
  cleanPastedHtml,
  hasImageUploads,
  savedDocument,
} from './image-uploads';

type Draft = PostSnapshot & {
  id: string;
  version: number;
  status: 'draft' | 'published';
  lockedSlug: boolean;
};
type SaveState = 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict';
type RevisionSummary = {
  id: string;
  postVersion: number;
  kind: RevisionKind;
  title: string;
  characterCount: number;
  createdAt: string;
};
type RevisionDetail = {
  id: string;
  kind: RevisionKind;
  createdAt: string;
  snapshot: PostSnapshot;
};
type MutationResult = {
  version: number;
  slug: string;
  status: 'draft' | 'published';
  firstPublishedAt: string | null;
  updatedAt: string;
  snapshot?: PostSnapshot;
};

const revisionLabels: Record<RevisionKind, string> = {
  auto: '自动存档',
  manual: '手动存档',
  publish: '发布版本',
  restore: '恢复后的版本',
  'restore-draft-backup': '恢复前草稿',
  'restore-public-backup': '恢复前线上版本',
};

function tagsFrom(value: string) {
  return [
    ...new Set(
      value
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

function formatSavedAt(value: Date | null) {
  if (!value) return '已保存';
  return `已于 ${value.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })} 保存`;
}

export function PostEditor({ initial }: { initial: Draft }) {
  const [draft, setDraftState] = useState(initial);
  const [tagText, setTagTextState] = useState(initial.tags.join('，'));
  const [dirty, setDirtyState] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [editTick, setEditTick] = useState(0);
  const [blocking, setBlocking] = useState(false);
  const [message, setMessage] = useState('');
  const [inputNotice, setInputNotice] = useState('');
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [selectedRevision, setSelectedRevision] =
    useState<RevisionDetail | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(initial);
  const tagTextRef = useRef(initial.tags.join('，'));
  const dirtyRef = useRef(false);
  const editSerialRef = useRef(0);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const publishingRef = useRef(false);
  const confirmedDepartureRef = useRef(false);
  const [uploadQueue] = useState(
    () =>
      new ImageUploadQueue(
        () => editorRef.current,
        () => draftRef.current.id,
        setInputNotice,
      ),
  );

  function markDirty() {
    editSerialRef.current += 1;
    dirtyRef.current = true;
    setDirtyState(true);
    setSaveState('dirty');
    setMessage('');
    setEditTick((value) => value + 1);
  }

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [2, 3] },
        strike: false,
        underline: false,
        horizontalRule: false,
        link: { openOnClick: false },
      }),
      CaptionedImage,
      HighlightedCodeBlock,
      ImageUploadPlaceholder.configure({
        retry: (id) => uploadQueue.retry(id),
        available: (id) => uploadQueue.available(id),
      }),
      Placeholder.configure({ placeholder: '从一个想法开始……' }),
    ],
    content: initial.content,
    editorProps: {
      attributes: {
        class: 'article-content writing-editor',
        'aria-label': '文章正文',
        role: 'textbox',
        'aria-multiline': 'true',
      },
      transformPastedHTML: (html) => cleanPastedHtml(html, setInputNotice),
      handlePaste: (_view, event) => {
        const current = editorRef.current;
        if (!current || !event.clipboardData || !current.isEditable)
          return false;
        const files = clipboardFiles(event.clipboardData);
        if (!files.length) {
          const html = event.clipboardData.getData('text/html');
          if (
            !current.isActive('codeBlock') &&
            /<(?:h[1-6]|pre|ul|ol|blockquote)\b/i.test(html)
          ) {
            event.preventDefault();
            current.commands.insertContent(
              cleanPastedHtml(html, setInputNotice),
            );
            return true;
          }
          return false;
        }
        setInputNotice('');
        event.preventDefault();
        if (current.isActive('codeBlock')) {
          setInputNotice('请先移到代码块外，再粘贴图片。');
          return true;
        }
        const html = event.clipboardData.getData('text/html');
        const text = event.clipboardData.getData('text/plain');
        if (html)
          current.commands.insertContent(cleanPastedHtml(html, () => {}));
        else if (text) current.commands.insertContent({ type: 'text', text });
        uploadQueue.enqueue(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !event.dataTransfer || !view.editable) return false;
        const files = clipboardFiles(event.dataTransfer);
        const html = event.dataTransfer.getData('text/html');
        if (!files.length && !/<(?:img|picture|svg)\b/i.test(html))
          return false;
        event.preventDefault();
        const position = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })?.pos;
        if (position === undefined) return true;
        if (files.length) uploadQueue.enqueue(files, position);
        else
          editorRef.current?.commands.insertContentAt(
            position,
            cleanPastedHtml(html, setInputNotice),
          );
        return true;
      },
    },
    onUpdate: markDirty,
    onTransaction: () => uploadQueue.sync(),
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);
  useEffect(() => () => uploadQueue.dispose(), [uploadQueue]);
  const pendingImages = editor ? hasImageUploads(editor) : false;

  function setDraft(next: Draft) {
    draftRef.current = next;
    setDraftState(next);
  }

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft({ ...draftRef.current, [key]: value });
    markDirty();
  }

  function setTagText(value: string) {
    tagTextRef.current = value;
    setTagTextState(value);
    markDirty();
  }

  function payload(): PostSnapshot {
    return {
      title: draftRef.current.title,
      slug: draftRef.current.slug,
      excerpt: draftRef.current.excerpt,
      tags: tagsFrom(tagTextRef.current),
      coverAssetId: draftRef.current.coverAssetId,
      content: savedDocument(editorRef.current!.getJSON()),
    };
  }

  async function request(
    action: string,
    version: number,
    extra: Record<string, unknown> = {},
  ) {
    const response = await fetch(`/api/admin/posts/${draftRef.current.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, version, ...extra }),
    });
    const result = await response.json();
    if (!response.ok) {
      const failure = new Error(result.error || '操作失败，请重试') as Error & {
        status?: number;
      };
      failure.status = response.status;
      throw failure;
    }
    return result as MutationResult;
  }

  async function saveDraft(kind: 'auto' | 'manual') {
    if (!editorRef.current || publishingRef.current) return false;
    if (savePromiseRef.current) {
      const success = await savePromiseRef.current;
      if (!success) return false;
      if (dirtyRef.current) return saveDraft(kind);
      return true;
    }
    const serial = editSerialRef.current;
    setSaveState('saving');
    setError('');
    const running = (async () => {
      try {
        const result = await request('save', draftRef.current.version, {
          ...payload(),
          saveKind: kind,
        });
        setDraft({
          ...draftRef.current,
          version: result.version,
          slug: result.slug,
          status: result.status,
          lockedSlug: Boolean(result.firstPublishedAt),
        });
        if (editSerialRef.current === serial) {
          flushSync(() => {
            dirtyRef.current = false;
            setDirtyState(false);
          });
          setSaveState('saved');
          setLastSavedAt(new Date(result.updatedAt));
        } else {
          setSaveState('dirty');
        }
        if (kind === 'manual') setMessage('当前内容已存档');
        return true;
      } catch (caught) {
        const failure = caught as Error & { status?: number };
        setSaveState(failure.status === 409 ? 'conflict' : 'failed');
        setError(failure.message);
        return false;
      } finally {
        savePromiseRef.current = null;
      }
    })();
    savePromiseRef.current = running;
    return running;
  }

  useEffect(() => {
    if (!dirty || blocking) return;
    const timer = window.setTimeout(() => void saveDraft('auto'), 1500);
    return () => window.clearTimeout(timer);
  }, [blocking, dirty, editTick]);

  useEffect(() => {
    if (!dirty && !pendingImages) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!confirmedDepartureRef.current) event.preventDefault();
    };
    const beforeLink = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest('a');
      if (
        !link ||
        link.target === '_blank' ||
        link.getAttribute('href')?.startsWith('#')
      )
        return;
      if (!window.confirm('修改尚未完成保存，确定离开吗？')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', beforeLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', beforeLink, true);
    };
  }, [dirty, pendingImages]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveDraft('manual');
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  async function preview() {
    if (!imagesReady()) return;
    if (!(await saveDraft('auto'))) return;
    window.location.assign(`/admin/posts/${draftRef.current.id}/preview`);
  }

  async function publish() {
    if (!editorRef.current || blocking || publishingRef.current) return;
    if (!imagesReady()) return;
    publishingRef.current = true;
    editorRef.current.setEditable(false, false);
    const wasPublished = draftRef.current.status === 'published';
    setBlocking(true);
    setError('');
    setMessage('');
    try {
      if (savePromiseRef.current && !(await savePromiseRef.current)) return;
      const current = payload();
      const result = await request(
        'publish',
        draftRef.current.version,
        current,
      );
      setDraft({
        ...draftRef.current,
        title: current.title.trim() || '未命名文章',
        version: result.version,
        slug: result.slug,
        status: result.status,
        lockedSlug: Boolean(result.firstPublishedAt),
      });
      dirtyRef.current = false;
      setDirtyState(false);
      setSaveState('saved');
      setLastSavedAt(new Date(result.updatedAt));
      setMessage(
        wasPublished ? '已更新发布，网站已同步' : '已发布，网站已更新',
      );
    } catch (caught) {
      const failure = caught as Error & { status?: number };
      setSaveState(failure.status === 409 ? 'conflict' : saveState);
      setError(failure.message);
    } finally {
      publishingRef.current = false;
      editorRef.current?.setEditable(true, false);
      setBlocking(false);
    }
  }

  async function secondary(action: 'unpublish' | 'delete') {
    if (blocking || publishingRef.current) return;
    const prompt =
      action === 'delete'
        ? '确认删除这篇文章？删除后将从网站和文章列表移除。'
        : '确认下架？访客将无法访问这篇文章，草稿和存档会保留。';
    if (!window.confirm(prompt)) return;
    if (action === 'unpublish' && !(await saveDraft('auto'))) return;
    publishingRef.current = true;
    setBlocking(true);
    setError('');
    try {
      if (savePromiseRef.current && !(await savePromiseRef.current)) return;
      const result = await request(action, draftRef.current.version);
      setDraft({
        ...draftRef.current,
        version: result.version,
        slug: result.slug,
        status: result.status,
        lockedSlug: Boolean(result.firstPublishedAt),
      });
      setMessage(action === 'unpublish' ? '已下架，草稿和存档保留' : '已删除');
      if (action === 'delete') {
        confirmedDepartureRef.current = true;
        uploadQueue.dispose();
        dirtyRef.current = false;
        flushSync(() => setDirtyState(false));
        window.location.assign('/admin');
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      publishingRef.current = false;
      setBlocking(false);
    }
  }

  function imagesReady() {
    if (editorRef.current && hasImageUploads(editorRef.current)) {
      setError(
        '还有图片未上传完成，请等待上传、重试失败图片或移除占位后再继续。',
      );
      return false;
    }
    return true;
  }

  async function upload(file: File | undefined) {
    if (!file || !editorRef.current) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('图片不能超过 10MB');
      return;
    }
    setBlocking(true);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('postId', draftRef.current.id);
      form.set('alt', '');
      const response = await fetch('/api/admin/assets', {
        method: 'POST',
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '图片上传失败');
      change('coverAssetId', result.id);
      setMessage('封面已上传，将自动保存');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBlocking(false);
      if (fileRef.current) fileRef.current.value = '';
      if (coverRef.current) coverRef.current.value = '';
    }
  }

  function link() {
    if (!editorRef.current) return;
    const href = window.prompt(
      '链接地址（https://…），留空可移除链接',
      editorRef.current.getAttributes('link').href ?? '',
    );
    if (href === null) return;
    if (!href) {
      editorRef.current
        .chain()
        .focus()
        .extendMarkRange('link')
        .unsetLink()
        .run();
      return;
    }
    if (!safeHref(href)) {
      setError('请输入有效的 http、https、mailto、站内或锚点链接');
      return;
    }
    editorRef.current
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href })
      .run();
  }

  async function loadRevisions(reset = false) {
    setHistoryBusy(true);
    setError('');
    try {
      const cursor = reset ? null : nextCursor;
      const response = await fetch(
        `/api/admin/posts/${draftRef.current.id}/revisions${
          cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
        }`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '读取存档失败');
      setRevisions((current) =>
        reset ? result.items : [...current, ...result.items],
      );
      setNextCursor(result.nextCursor);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setHistoryBusy(false);
    }
  }

  async function openHistory() {
    if (!(await saveDraft('auto'))) return;
    setHistoryOpen(true);
    setSelectedRevision(null);
    await loadRevisions(true);
  }

  async function inspectRevision(id: string) {
    setHistoryBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/posts/${draftRef.current.id}/revisions/${id}`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '读取存档失败');
      setSelectedRevision(result);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setHistoryBusy(false);
    }
  }

  async function restoreRevision() {
    if (!selectedRevision || blocking) return;
    if (!imagesReady()) return;
    const warning =
      draftRef.current.status === 'published'
        ? '恢复后会立即覆盖线上文章。系统会先保存当前草稿和线上版本，确认继续？'
        : '确认恢复这个版本？当前草稿会先自动备份。';
    if (!window.confirm(warning)) return;
    setBlocking(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/posts/${draftRef.current.id}/revisions/${selectedRevision.id}/restore`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: draftRef.current.version }),
        },
      );
      const result = (await response.json()) as MutationResult & {
        error?: string;
        snapshot: PostSnapshot;
      };
      if (!response.ok) throw new Error(result.error || '恢复失败');
      const restored = result.snapshot;
      editorRef.current?.commands.setContent(restored.content, {
        emitUpdate: false,
      });
      tagTextRef.current = restored.tags.join('，');
      setTagTextState(tagTextRef.current);
      setDraft({
        ...draftRef.current,
        ...restored,
        version: result.version,
        status: result.status,
        lockedSlug: Boolean(result.firstPublishedAt),
      });
      dirtyRef.current = false;
      setDirtyState(false);
      setSaveState('saved');
      setLastSavedAt(new Date(result.updatedAt));
      setSelectedRevision(null);
      setMessage(
        result.status === 'published'
          ? '历史版本已恢复，线上文章已同步'
          : '历史版本已恢复到草稿',
      );
      await loadRevisions(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBlocking(false);
    }
  }

  const tools = editor
    ? ([
        [
          '粗体',
          Bold,
          editor.isActive('bold'),
          () => editor.chain().focus().toggleBold().run(),
        ],
        [
          '斜体',
          Italic,
          editor.isActive('italic'),
          () => editor.chain().focus().toggleItalic().run(),
        ],
        [
          '二级标题',
          Heading2,
          editor.isActive('heading', { level: 2 }),
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        ],
        [
          '三级标题',
          Heading3,
          editor.isActive('heading', { level: 3 }),
          () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        ],
        [
          '无序列表',
          List,
          editor.isActive('bulletList'),
          () => editor.chain().focus().toggleBulletList().run(),
        ],
        [
          '有序列表',
          ListOrdered,
          editor.isActive('orderedList'),
          () => editor.chain().focus().toggleOrderedList().run(),
        ],
        [
          '引用',
          Quote,
          editor.isActive('blockquote'),
          () => editor.chain().focus().toggleBlockquote().run(),
        ],
        [
          '行内代码',
          Code,
          editor.isActive('code'),
          () => editor.chain().focus().toggleCode().run(),
        ],
        [
          '代码块',
          Code2,
          editor.isActive('codeBlock'),
          () => editor.chain().focus().toggleCodeBlock().run(),
        ],
        ['链接', Link2, editor.isActive('link'), link],
        ['撤销', Undo2, false, () => editor.chain().focus().undo().run()],
        ['重做', Redo2, false, () => editor.chain().focus().redo().run()],
      ] as const)
    : [];

  const stateText =
    saveState === 'saving'
      ? '正在自动保存…'
      : saveState === 'dirty'
        ? '未保存'
        : saveState === 'failed'
          ? '保存失败，点击重试'
          : saveState === 'conflict'
            ? '版本冲突，请重新加载'
            : formatSavedAt(lastSavedAt);
  const currentPayload = editor
    ? {
        title: draft.title,
        slug: draft.slug,
        excerpt: draft.excerpt,
        tags: tagsFrom(tagText),
        coverAssetId: draft.coverAssetId,
        content: savedDocument(editor.getJSON()),
      }
    : null;

  return (
    <main className="admin-editor-main">
      <div className="editor-top">
        <Link href="/admin">← 我的文章</Link>
        <div className="admin-actions editor-main-actions">
          <button
            className={`save-state save-state-${saveState}`}
            onClick={() =>
              saveState === 'failed' || saveState === 'dirty'
                ? void saveDraft('auto')
                : undefined
            }
          >
            {saveState === 'saving' ? (
              <Clock3 size={13} />
            ) : (
              <Check size={13} />
            )}
            {stateText}
          </button>
          <button
            className="admin-button archive-action"
            onClick={() => void saveDraft('manual')}
            disabled={blocking}
          >
            存档版本
          </button>
          <button
            className="admin-button archive-action"
            onClick={() => void openHistory()}
            disabled={blocking}
          >
            <History size={15} /> 历史版本
          </button>
          <details className="mobile-editor-menu">
            <summary aria-label="更多写作操作">
              <MoreHorizontal size={18} />
            </summary>
            <div>
              <button
                onClick={() => void saveDraft('manual')}
                disabled={blocking}
              >
                存档版本
              </button>
              <button onClick={() => void openHistory()} disabled={blocking}>
                历史版本
              </button>
            </div>
          </details>
          <button
            className="admin-button"
            onClick={() => void preview()}
            disabled={blocking}
          >
            预览
          </button>
          <button
            className="admin-button danger"
            aria-label="删除文章"
            title="删除文章"
            disabled={blocking}
            onClick={() => void secondary('delete')}
          >
            <Trash2 size={15} aria-hidden="true" /> 删除
          </button>
        </div>
      </div>
      <div className="editor-feedback" aria-live="polite">
        <span>{message}</span>
        {inputNotice && <span>{inputNotice}</span>}
        {pendingImages && <span>图片上传任务尚未完成，文字会继续自动保存</span>}
        {error && (
          <span className="error" role="alert">
            {error}{' '}
            {error.includes('登录') && (
              <a href="/admin/login" target="_blank" rel="noreferrer">
                在新窗口登录
              </a>
            )}
          </span>
        )}
      </div>
      <section className="editor-paper">
        <label className="sr-only" htmlFor="post-title">
          文章标题
        </label>
        <textarea
          rows={1}
          className="editor-title"
          id="post-title"
          placeholder="给这篇文章起个标题"
          value={draft.title}
          disabled={blocking}
          onChange={(event) => change('title', event.target.value)}
        />
        <div className="editor-toolbar" role="toolbar" aria-label="正文格式">
          {tools.map(([label, Icon, active, run]) => (
            <button
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={active}
              key={label}
              disabled={blocking}
              onMouseDown={(event) => event.preventDefault()}
              onClick={run}
            >
              <Icon size={18} />
            </button>
          ))}
          <button
            type="button"
            title="插入图片"
            aria-label="插入图片"
            disabled={blocking}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={18} />
          </button>
        </div>
        <EditorContent editor={editor} />
      </section>

      <section className="editor-publish" aria-labelledby="publish-heading">
        <h2 id="publish-heading">发布文章</h2>
        <p className="field-hint">以下信息均为可选。写好后直接在底部发布。</p>
        <div className="publish-summary">
          <strong>{draft.title.trim() || '未命名文章'}</strong>
          <span>
            {nodeText(currentPayload?.content ?? initial.content).length} 字 ·{' '}
            {imageIds(currentPayload?.content ?? initial.content).length}{' '}
            张正文图片
          </span>
        </div>
        <div className="editor-settings">
          <label>
            标签
            <input
              value={tagText}
              disabled={blocking}
              placeholder="技术探索，思考随笔"
              onChange={(event) => setTagText(event.target.value)}
            />
            <span className="field-hint">用中文或英文逗号分隔，数量不限</span>
          </label>
          <label>
            固定链接
            <input
              value={draft.slug}
              disabled={blocking || draft.lockedSlug}
              maxLength={180}
              placeholder="my-first-post"
              onChange={(event) => change('slug', event.target.value)}
            />
            <span className="field-hint">
              {draft.lockedSlug
                ? '已发布的链接保持固定'
                : '可留空自动生成，发布后固定'}
            </span>
          </label>
          <label>
            摘要 · 可选
            <textarea
              value={draft.excerpt}
              disabled={blocking}
              rows={4}
              onChange={(event) => change('excerpt', event.target.value)}
              placeholder="简短介绍，显示在文章开头"
            />
          </label>
          <div className="cover-setting">
            <span>封面 · 可选</span>
            {draft.coverAssetId ? (
              <>
                <Image
                  src={`/api/assets/${draft.coverAssetId}`}
                  alt="封面预览"
                  width={600}
                  height={400}
                  unoptimized
                />
                <button
                  disabled={blocking}
                  className="admin-button"
                  onClick={() => change('coverAssetId', null)}
                >
                  移除封面
                </button>
              </>
            ) : (
              <button
                disabled={blocking}
                className="cover-upload"
                onClick={() => coverRef.current?.click()}
              >
                <ImagePlus size={22} />
                选择封面图片
              </button>
            )}
            <span className="field-hint">
              JPEG / PNG / WebP，单张不超过 10MB
            </span>
          </div>
          <div className="editor-secondary">
            {draft.status === 'published' && (
              <>
                <a
                  href={`/blog/${draft.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看已发布文章 ↗
                </a>
                <button
                  className="admin-button"
                  disabled={blocking}
                  onClick={() => void secondary('unpublish')}
                >
                  下架文章
                </button>
              </>
            )}
            <button
              className="admin-button danger"
              disabled={blocking}
              onClick={() => void secondary('delete')}
            >
              删除文章
            </button>
          </div>
          <div className="publish-feedback" aria-live="polite">
            {error ? <span className="error">{error}</span> : message}
          </div>
          <button
            className="admin-button primary publish-action"
            disabled={blocking}
            onClick={() => void publish()}
          >
            {publishingRef.current
              ? '正在发布…'
              : draft.status === 'published'
                ? '更新发布'
                : '发布文章'}
          </button>
        </div>
      </section>

      {historyOpen && (
        <Drawer title="历史版本" onClose={() => setHistoryOpen(false)} wide>
          <p className="drawer-intro">
            自动存档每 5 分钟最多生成一个版本；所有版本永久保留。
          </p>
          {selectedRevision ? (
            <div className="revision-preview">
              <button
                className="revision-back"
                onClick={() => setSelectedRevision(null)}
              >
                ← 返回版本列表
              </button>
              <span className="revision-kind">
                {revisionLabels[selectedRevision.kind]} ·{' '}
                {new Date(selectedRevision.createdAt).toLocaleString('zh-CN')}
              </span>
              <h2>{selectedRevision.snapshot.title || '未命名文章'}</h2>
              {selectedRevision.snapshot.excerpt && (
                <p>{selectedRevision.snapshot.excerpt}</p>
              )}
              <ArticleContent document={selectedRevision.snapshot.content} />
              <button
                className="admin-button primary drawer-primary"
                disabled={blocking}
                onClick={() => void restoreRevision()}
              >
                {draft.status === 'published'
                  ? '恢复并覆盖线上版本'
                  : '恢复到当前草稿'}
              </button>
            </div>
          ) : (
            <div className="revision-list">
              {revisions.map((revision) => (
                <button
                  key={revision.id}
                  onClick={() => void inspectRevision(revision.id)}
                  disabled={historyBusy}
                >
                  <span>
                    <strong>{revisionLabels[revision.kind]}</strong>
                    <time>
                      {new Date(revision.createdAt).toLocaleString('zh-CN')}
                    </time>
                  </span>
                  <span>
                    {revision.title} · {revision.characterCount} 字
                  </span>
                </button>
              ))}
              {!historyBusy && revisions.length === 0 && (
                <p className="revision-empty">
                  还没有存档。继续写作或点击“存档版本”后会出现在这里。
                </p>
              )}
              {nextCursor && (
                <button
                  className="admin-button load-more"
                  disabled={historyBusy}
                  onClick={() => void loadRevisions(false)}
                >
                  加载更多
                </button>
              )}
              {historyBusy && <p className="revision-empty">正在读取存档…</p>}
            </div>
          )}
        </Drawer>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          uploadQueue.enqueue(
            Array.from(event.target.files ?? []),
            undefined,
            true,
          );
          event.target.value = '';
        }}
      />
      <input
        ref={coverRef}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
    </main>
  );
}

function Drawer({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="editor-drawer-backdrop">
      <button
        className="editor-drawer-dismiss"
        aria-label={`点击遮罩关闭${title}`}
        onClick={onClose}
      />
      <dialog
        open
        className={`editor-drawer${wide ? ' wide' : ''}`}
        aria-label={title}
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label={`关闭${title}`} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="editor-drawer-body">{children}</div>
      </dialog>
    </div>
  );
}
