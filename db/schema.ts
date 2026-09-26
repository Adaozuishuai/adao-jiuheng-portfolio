import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { EditorDocument, PostSnapshot } from '@/lib/blog/types';

export const postStatus = pgEnum('post_status', ['draft', 'published']);
export const revisionKind = pgEnum('revision_kind', [
  'auto',
  'manual',
  'publish',
  'restore',
  'restore-draft-backup',
  'restore-public-backup',
]);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    draftTitle: text('draft_title').notNull().default('未命名文章'),
    draftSlug: varchar('draft_slug', { length: 180 }).notNull().default(''),
    draftExcerpt: text('draft_excerpt').notNull().default(''),
    draftTags: text('draft_tags').array().notNull().default([]),
    draftCoverAssetId: uuid('draft_cover_asset_id'),
    draftContent: jsonb('draft_content').$type<EditorDocument>().notNull(),
    publishedTitle: text('published_title'),
    publishedSlug: varchar('published_slug', { length: 180 }),
    publishedExcerpt: text('published_excerpt'),
    publishedTags: text('published_tags').array().notNull().default([]),
    publishedCoverAssetId: uuid('published_cover_asset_id'),
    publishedContent: jsonb('published_content').$type<EditorDocument>(),
    status: postStatus('status').notNull().default('draft'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    firstPublishedAt: timestamp('first_published_at', { withTimezone: true }),
    lastPublishedAt: timestamp('last_published_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('posts_published_slug_unique').on(table.publishedSlug),
    index('posts_public_idx').on(
      table.status,
      table.deletedAt,
      table.firstPublishedAt,
    ),
  ],
);

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id').references(() => posts.id, {
      onDelete: 'set null',
    }),
    objectKey: text('object_key').notNull().unique(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 32 }).notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    alt: varchar('alt', { length: 240 }).notNull(),
    isPublic: boolean('is_public').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('assets_post_idx').on(table.postId)],
);

export const postRevisions = pgTable(
  'post_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    postVersion: integer('post_version').notNull(),
    kind: revisionKind('kind').notNull(),
    title: text('title').notNull(),
    characterCount: integer('character_count').notNull(),
    snapshot: jsonb('snapshot').$type<PostSnapshot>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('post_revisions_post_created_idx').on(
      table.postId,
      table.createdAt,
      table.id,
    ),
  ],
);

export const administrators = pgTable(
  'administrators',
  {
    id: integer('id').primaryKey().default(1),
    username: varchar('username', { length: 80 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
  },
  (table) => [check('administrators_singleton', sql`${table.id} = 1`)],
);
export const adminSessions = pgTable('admin_sessions', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
export const loginLimits = pgTable('login_limits', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
});

// Keep legacy tables represented so future migrations never drop existing data.
export const legacyAdmins = pgTable('admins', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  passwordIterations: integer('password_iterations').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const legacySessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => legacyAdmins.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('sessions_admin_idx').on(table.adminId),
    index('sessions_expiry_idx').on(table.expiresAt),
  ],
);
export const legacyLoginAttempts = pgTable(
  'login_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    identityHash: varchar('identity_hash', { length: 64 }).notNull(),
    failedCount: integer('failed_count').notNull().default(0),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    blockedUntil: timestamp('blocked_until', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('login_attempts_identity_unique').on(table.identityHash),
  ],
);
