export type EditorMark = {
  type: 'bold' | 'italic' | 'code' | 'link';
  attrs?: { href?: string };
};
export type EditorNode = {
  type:
    | 'doc'
    | 'paragraph'
    | 'heading'
    | 'text'
    | 'bulletList'
    | 'orderedList'
    | 'listItem'
    | 'blockquote'
    | 'codeBlock'
    | 'image'
    | 'hardBreak';
  attrs?: {
    level?: number;
    src?: string;
    alt?: string;
    title?: string | null;
    language?: string;
  };
  marks?: EditorMark[];
  text?: string;
  content?: EditorNode[];
};
export type EditorDocument = EditorNode & { type: 'doc' };
export type PostSnapshot = {
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  coverAssetId: string | null;
  content: EditorDocument;
};
export type RevisionKind =
  | 'auto'
  | 'manual'
  | 'publish'
  | 'restore'
  | 'restore-draft-backup'
  | 'restore-public-backup';
export type PublishedPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  coverAssetId: string | null;
  content: EditorDocument;
  firstPublishedAt: Date;
  lastPublishedAt: Date;
};
