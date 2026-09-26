CREATE TABLE "admin_sessions" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "administrators" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"username" varchar(80) NOT NULL,
	"password_hash" text NOT NULL,
	CONSTRAINT "administrators_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "login_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "draft_tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "published_tags" text[] DEFAULT '{}' NOT NULL;