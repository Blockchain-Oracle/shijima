CREATE TYPE "public"."ask_path" AS ENUM('signin', 'session', 'wallet');--> statement-breakpoint
CREATE TYPE "public"."ask_proposal_status" AS ENUM('open', 'confirmed', 'done', 'refused', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ask_request_kind" AS ENUM('ask', 'readback');--> statement-breakpoint
CREATE TYPE "public"."ask_request_status" AS ENUM('pending', 'claimed', 'answered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."check_request_status" AS ENUM('pending', 'done', 'refused');--> statement-breakpoint
CREATE TYPE "public"."price_alert_kind" AS ENUM('above_reference', 'below_reference', 'either_way');--> statement-breakpoint
CREATE TYPE "public"."price_alert_status" AS ENUM('active', 'fired', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."answer_channel" ADD VALUE 'chat';--> statement-breakpoint
ALTER TYPE "public"."approval_reason" ADD VALUE 'owner_override';--> statement-breakpoint
ALTER TYPE "public"."decision_outcome" ADD VALUE 'acted_by_override';--> statement-breakpoint
ALTER TYPE "public"."desk_event_kind" ADD VALUE 'owner_action';--> statement-breakpoint
ALTER TYPE "public"."desk_event_kind" ADD VALUE 'session_granted';--> statement-breakpoint
ALTER TYPE "public"."desk_event_kind" ADD VALUE 'session_revoked';--> statement-breakpoint
ALTER TYPE "public"."event_via" ADD VALUE 'chat';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'price_alert';--> statement-breakpoint
CREATE TABLE "ask_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"desk_id" uuid,
	"owner_address" text NOT NULL,
	"kind" text NOT NULL,
	"args" jsonb NOT NULL,
	"desk_view" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"path" "ask_path" NOT NULL,
	"status" "ask_proposal_status" DEFAULT 'open' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"tx_hash" text,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ask_proposals_owner_format" CHECK ("ask_proposals"."owner_address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "ask_proposals_tx_hash_format" CHECK ("ask_proposals"."tx_hash" IS NULL OR "ask_proposals"."tx_hash" ~ '^0x[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "ask_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_address" text NOT NULL,
	"desk_id" uuid,
	"kind" "ask_request_kind" NOT NULL,
	"via" "event_via" NOT NULL,
	"question" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "ask_request_status" DEFAULT 'pending' NOT NULL,
	"reply" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	CONSTRAINT "ask_requests_owner_format" CHECK ("ask_requests"."owner_address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "ask_requests_question_length" CHECK (char_length("ask_requests"."question") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "check_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"desk_id" uuid NOT NULL,
	"requested_by" text NOT NULL,
	"via" "event_via" NOT NULL,
	"proposal_id" uuid,
	"status" "check_request_status" DEFAULT 'pending' NOT NULL,
	"refused_reason" text,
	"wake_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone,
	CONSTRAINT "check_requests_by_format" CHECK ("check_requests"."requested_by" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_address" text NOT NULL,
	"desk_id" uuid,
	"token" text NOT NULL,
	"kind" "price_alert_kind" NOT NULL,
	"threshold_bps" integer NOT NULL,
	"status" "price_alert_status" DEFAULT 'active' NOT NULL,
	"fired_gap_bps" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fired_at" timestamp with time zone,
	CONSTRAINT "price_alerts_owner_format" CHECK ("price_alerts"."owner_address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "price_alerts_token_format" CHECK ("price_alerts"."token" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "price_alerts_threshold_range" CHECK ("price_alerts"."threshold_bps" > 0 AND "price_alerts"."threshold_bps" <= 5000)
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ask_proposals" ADD CONSTRAINT "ask_proposals_request_id_ask_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."ask_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_proposals" ADD CONSTRAINT "ask_proposals_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_requests" ADD CONSTRAINT "ask_requests_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_requests" ADD CONSTRAINT "check_requests_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_requests" ADD CONSTRAINT "check_requests_proposal_id_ask_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."ask_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_requests" ADD CONSTRAINT "check_requests_wake_id_wakes_id_fk" FOREIGN KEY ("wake_id") REFERENCES "public"."wakes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ask_proposals_desk_idx" ON "ask_proposals" USING btree ("desk_id","created_at");--> statement-breakpoint
CREATE INDEX "ask_requests_pending_idx" ON "ask_requests" USING btree ("created_at") WHERE "ask_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "ask_requests_owner_at_idx" ON "ask_requests" USING btree ("owner_address","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "check_requests_one_pending_key" ON "check_requests" USING btree ("desk_id") WHERE "check_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "price_alerts_active_idx" ON "price_alerts" USING btree ("token") WHERE "price_alerts"."status" = 'active';