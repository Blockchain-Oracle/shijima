CREATE TYPE "public"."copy_link_status" AS ENUM('active', 'paused', 'stopped');--> statement-breakpoint
ALTER TYPE "public"."wake_trigger" ADD VALUE 'copy';--> statement-breakpoint
CREATE TABLE "copy_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_desk_id" uuid NOT NULL,
	"leader_desk_id" uuid NOT NULL,
	"fee_usdg" numeric(78, 0) DEFAULT 0 NOT NULL,
	"creator_fee_tx" text,
	"platform_fee_tx" text,
	"status" "copy_link_status" DEFAULT 'active' NOT NULL,
	"active_since" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "copy_links_not_self" CHECK ("copy_links"."follower_desk_id" <> "copy_links"."leader_desk_id"),
	CONSTRAINT "copy_links_fee_nonneg" CHECK ("copy_links"."fee_usdg" >= 0),
	CONSTRAINT "copy_links_creator_fee_tx_format" CHECK ("copy_links"."creator_fee_tx" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "copy_links_platform_fee_tx_format" CHECK ("copy_links"."platform_fee_tx" ~ '^0x[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "copied_from_decision_id" uuid;--> statement-breakpoint
ALTER TABLE "desks" ADD COLUMN "copyable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "desks" ADD COLUMN "copy_fee_usdg" numeric(78, 0) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "follow" jsonb;--> statement-breakpoint
ALTER TABLE "copy_links" ADD CONSTRAINT "copy_links_follower_desk_id_desks_id_fk" FOREIGN KEY ("follower_desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_links" ADD CONSTRAINT "copy_links_leader_desk_id_desks_id_fk" FOREIGN KEY ("leader_desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "copy_links_one_active_follower_key" ON "copy_links" USING btree ("follower_desk_id") WHERE "copy_links"."status" <> 'stopped';--> statement-breakpoint
CREATE INDEX "copy_links_leader_idx" ON "copy_links" USING btree ("leader_desk_id","status");--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_copied_from_decision_id_decisions_id_fk" FOREIGN KEY ("copied_from_decision_id") REFERENCES "public"."decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "decisions_desk_copied_from_key" ON "decisions" USING btree ("desk_id","copied_from_decision_id") WHERE "decisions"."copied_from_decision_id" is not null;--> statement-breakpoint
ALTER TABLE "desks" ADD CONSTRAINT "desks_copy_fee_nonneg" CHECK ("desks"."copy_fee_usdg" >= 0);