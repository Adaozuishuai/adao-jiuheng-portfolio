ALTER TABLE "post_revisions" ALTER COLUMN "title" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "draft_title" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "draft_title" SET DEFAULT '未命名文章';--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "draft_excerpt" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "draft_excerpt" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "published_title" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "published_excerpt" SET DATA TYPE text;