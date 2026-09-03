DROP INDEX "payment_attempts_order_unique";--> statement-breakpoint
DROP INDEX "payment_attempts_checkout_attempt_unique";--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "authorization_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_order_live_unique" ON "payment_attempts" USING btree ("order_id") WHERE "payment_attempts"."status" in ('initialized', 'pending', 'processing');--> statement-breakpoint
CREATE INDEX "payment_attempts_checkout_attempt_idx" ON "payment_attempts" USING btree ("checkout_attempt_id");