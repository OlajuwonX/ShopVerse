CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"identifier_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limits_attempts_nonnegative" CHECK ("rate_limits"."attempts" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limits_action_identifier_unique" ON "rate_limits" USING btree ("action","identifier_hash");--> statement-breakpoint
CREATE INDEX "rate_limits_blocked_until_idx" ON "rate_limits" USING btree ("blocked_until");