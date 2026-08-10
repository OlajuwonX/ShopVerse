CREATE TYPE "public"."media_cleanup_reason" AS ENUM('orphaned_upload', 'detached_asset', 'rejected_upload');--> statement-breakpoint
CREATE TYPE "public"."media_cleanup_status" AS ENUM('pending', 'resolved', 'failed');--> statement-breakpoint
CREATE TABLE "media_cleanup_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"reason" "media_cleanup_reason" NOT NULL,
	"status" "media_cleanup_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "media_cleanup_queue_attempts_nonnegative" CHECK ("media_cleanup_queue"."attempts" >= 0),
	CONSTRAINT "media_cleanup_queue_resolved_at_matches_status" CHECK (("media_cleanup_queue"."status" = 'resolved' and "media_cleanup_queue"."resolved_at" is not null) or ("media_cleanup_queue"."status" <> 'resolved' and "media_cleanup_queue"."resolved_at" is null))
);
--> statement-breakpoint
CREATE INDEX "media_cleanup_queue_status_created_idx" ON "media_cleanup_queue" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "media_cleanup_queue_public_id_idx" ON "media_cleanup_queue" USING btree ("cloudinary_public_id");