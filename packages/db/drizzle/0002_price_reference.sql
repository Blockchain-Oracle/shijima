ALTER TABLE "price_points" ADD COLUMN "reference_e8" numeric(78, 0);--> statement-breakpoint
ALTER TABLE "price_points" ADD COLUMN "reference_kind" text;--> statement-breakpoint
ALTER TABLE "price_points" ADD COLUMN "reference_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "price_points" ADD CONSTRAINT "price_points_reference_kind" CHECK ("price_points"."reference_kind" IS NULL OR "price_points"."reference_kind" IN ('last_regular_close', 'last_official_update'));