CREATE TYPE "public"."action_kind" AS ENUM('buy', 'sell', 'sweep', 'redeem', 'checkpoint', 'pause');--> statement-breakpoint
CREATE TYPE "public"."action_status" AS ENUM('planned', 'prepared', 'sent', 'confirmed', 'reverted', 'never_landed');--> statement-breakpoint
CREATE TYPE "public"."answer_channel" AS ENUM('telegram', 'web');--> statement-breakpoint
CREATE TYPE "public"."approval_reason" AS ENUM('ask_first', 'large_action');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."cash_flow_kind" AS ENUM('deposit', 'withdrawal', 'bridge_in_flight');--> statement-breakpoint
CREATE TYPE "public"."cash_flow_status" AS ENUM('pending', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."company_event_kind" AS ENUM('earnings', 'dividend', 'split', 'other');--> statement-breakpoint
CREATE TYPE "public"."decision_outcome" AS ENUM('acted', 'acted_in_part', 'waited', 'declined', 'nothing_to_do', 'blocked_by_limit', 'asked', 'failed', 'would_have_acted', 'not_executed');--> statement-breakpoint
CREATE TYPE "public"."deferral_status" AS ENUM('standing', 'broken', 'revisited', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."desk_event_kind" AS ENUM('paused', 'resumed', 'mode_changed', 'mandate_applied', 'limits_changed', 'operator_set', 'operator_revoked', 'loss_stop', 'promoted', 'demoted', 'telegram_linked', 'telegram_unlinked', 'share_changed', 'holdings_changed_outside', 'closed');--> statement-breakpoint
CREATE TYPE "public"."desk_lifecycle" AS ENUM('onboarding', 'running', 'closing', 'closed');--> statement-breakpoint
CREATE TYPE "public"."desk_mode" AS ENUM('shadow', 'ask_first', 'on_its_own');--> statement-breakpoint
CREATE TYPE "public"."desk_state" AS ENUM('active', 'paused_by_owner', 'stopped_by_loss_limit', 'needs_attention');--> statement-breakpoint
CREATE TYPE "public"."event_actor" AS ENUM('owner', 'desk', 'system');--> statement-breakpoint
CREATE TYPE "public"."event_via" AS ENUM('web', 'telegram', 'chain', 'worker');--> statement-breakpoint
CREATE TYPE "public"."grade_verdict" AS ENUM('better', 'worse', 'no_real_difference', 'ungradable');--> statement-breakpoint
CREATE TYPE "public"."mandate_status" AS ENUM('draft', 'applied', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."multiplier_event_kind" AS ENUM('split', 'dividend', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('status', 'approval_request', 'large_action_request', 'acted', 'would_have', 'not_acted', 'alert', 'monday_report', 'first_contact');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."record_kind" AS ENUM('decision', 'execution');--> statement-breakpoint
CREATE TYPE "public"."reference_kind" AS ENUM('close', 'open');--> statement-breakpoint
CREATE TYPE "public"."serv_mode" AS ENUM('serv', 'raw');--> statement-breakpoint
CREATE TYPE "public"."telegram_link_status" AS ENUM('pending', 'linked', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."token_flag" AS ENUM('halted', 'oracle_paused', 'feed_unavailable', 'beyond_band', 'blocked', 'company_event', 'multiplier_changed', 'better_tier_available');--> statement-breakpoint
CREATE TYPE "public"."trade_side" AS ENUM('buy', 'sell', 'sweep', 'redeem');--> statement-breakpoint
CREATE TYPE "public"."value_snapshot_kind" AS ENUM('hourly', 'close', 'open', 'manual');--> statement-breakpoint
CREATE TYPE "public"."wake_status" AS ENUM('running', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."wake_trigger" AS ENUM('cron', 'tick', 'manual', 'approval', 'skeleton');--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"desk_id" uuid NOT NULL,
	"leg" integer DEFAULT 0 NOT NULL,
	"kind" "action_kind" NOT NULL,
	"status" "action_status" DEFAULT 'planned' NOT NULL,
	"operator" text NOT NULL,
	"nonce" integer,
	"tx_hash" text,
	"calldata_hash" text,
	"deadline_unix" bigint,
	"token" text,
	"amount_in" numeric(78, 0),
	"expected_out" numeric(78, 0),
	"min_out" numeric(78, 0),
	"actual_out" numeric(78, 0),
	"chain_seq" bigint,
	"block_number" bigint,
	"gas_used" numeric(78, 0),
	"effective_gas_price" numeric(78, 0),
	"feed_price_e8" numeric(78, 0),
	"failure_code" text,
	"failure_detail" text,
	"planned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"prepared_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "actions_signed_has_hash_and_nonce" CHECK ("actions"."status" = 'planned' or "actions"."status" = 'never_landed' or ("actions"."tx_hash" is not null and "actions"."nonce" is not null)),
	CONSTRAINT "actions_operator_format" CHECK ("actions"."operator" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "actions_token_format" CHECK ("actions"."token" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "actions_tx_hash_format" CHECK ("actions"."tx_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "actions_calldata_hash_format" CHECK ("actions"."calldata_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "actions_amount_in_nonneg" CHECK ("actions"."amount_in" >= 0),
	CONSTRAINT "actions_expected_out_nonneg" CHECK ("actions"."expected_out" >= 0),
	CONSTRAINT "actions_min_out_nonneg" CHECK ("actions"."min_out" >= 0),
	CONSTRAINT "actions_actual_out_nonneg" CHECK ("actions"."actual_out" >= 0)
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"desk_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"reason" "approval_reason" NOT NULL,
	"preview" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"answered_by" uuid,
	"answered_at" timestamp with time zone,
	"answered_via" "answer_channel",
	"telegram_message_id" bigint,
	"execution_decision_id" uuid,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approvals_answer_is_complete" CHECK (("approvals"."status" in ('approved', 'rejected')) = ("approvals"."answered_by" is not null and "approvals"."answered_at" is not null and "approvals"."answered_via" is not null))
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"desk_id" uuid NOT NULL,
	"wake_id" uuid,
	"seq" integer NOT NULL,
	"kind" "record_kind" DEFAULT 'decision' NOT NULL,
	"schema_version" integer NOT NULL,
	"outcome" "decision_outcome" NOT NULL,
	"mode" "desk_mode" NOT NULL,
	"shadow" boolean NOT NULL,
	"token" text,
	"side" "trade_side",
	"amount_usdg" numeric(78, 0),
	"confidence_percent" integer,
	"summary" text NOT NULL,
	"failure_code" text,
	"record" jsonb NOT NULL,
	"record_hash" text NOT NULL,
	"prev_hash" text NOT NULL,
	"private" jsonb,
	"result" jsonb,
	"sealed_by_tx" text,
	"sealed_at" timestamp with time zone,
	"decided_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisions_seq_positive" CHECK ("decisions"."seq" >= 1),
	CONSTRAINT "decisions_confidence_range" CHECK ("decisions"."confidence_percent" is null or "decisions"."confidence_percent" between 0 and 100),
	CONSTRAINT "decisions_record_hash_format" CHECK ("decisions"."record_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "decisions_prev_hash_format" CHECK ("decisions"."prev_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "decisions_sealed_by_tx_format" CHECK ("decisions"."sealed_by_tx" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "decisions_token_format" CHECK ("decisions"."token" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "decisions_amount_nonneg" CHECK ("decisions"."amount_usdg" >= 0)
);
--> statement-breakpoint
CREATE TABLE "deferrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"desk_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"token" text NOT NULL,
	"side" "trade_side" NOT NULL,
	"status" "deferral_status" DEFAULT 'standing' NOT NULL,
	"revisit_at" timestamp with time zone NOT NULL,
	"baseline" jsonb NOT NULL,
	"ended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "deferrals_token_format" CHECK ("deferrals"."token" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"desk_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"verdict" "grade_verdict" NOT NULL,
	"difference_bps" integer,
	"chosen" text NOT NULL,
	"alternative" text NOT NULL,
	"decision_price_e8" numeric(78, 0),
	"reopen_price_e8" numeric(78, 0),
	"replay" boolean DEFAULT false NOT NULL,
	"detail" jsonb,
	"graded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grades_ungradable_has_no_number" CHECK (("grades"."verdict" = 'ungradable') = ("grades"."difference_bps" is null))
);
--> statement-breakpoint
CREATE TABLE "wakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"desk_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"trigger" "wake_trigger" NOT NULL,
	"status" "wake_status" DEFAULT 'running' NOT NULL,
	"source_health" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "desk_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "desk_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"desk_id" uuid NOT NULL,
	"kind" "desk_event_kind" NOT NULL,
	"actor" "event_actor" NOT NULL,
	"via" "event_via" NOT NULL,
	"detail" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "desks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"chain_id" integer DEFAULT 4663 NOT NULL,
	"address" text NOT NULL,
	"factory" text NOT NULL,
	"salt" text NOT NULL,
	"contract_version" text NOT NULL,
	"operator" text NOT NULL,
	"invite_code" text,
	"name" text,
	"mode" "desk_mode" DEFAULT 'shadow' NOT NULL,
	"state" "desk_state" DEFAULT 'active' NOT NULL,
	"state_reason" text,
	"lifecycle" "desk_lifecycle" DEFAULT 'onboarding' NOT NULL,
	"deployed_at" timestamp with time zone,
	"deploy_tx" text,
	"first_funded_at" timestamp with time zone,
	"telegram_skipped_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"share_slug" text,
	"share_enabled" boolean DEFAULT false NOT NULL,
	"drawdown_baseline_usdg" numeric(78, 0),
	"drawdown_breaches" integer DEFAULT 0 NOT NULL,
	"shadow_checks" integer DEFAULT 0 NOT NULL,
	"shadow_report_opened_at" timestamp with time zone,
	"live_armed_at" timestamp with time zone,
	"demoted_at" timestamp with time zone,
	"demotion_reason" text,
	"chain_seq" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "desks_address_format" CHECK ("desks"."address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "desks_factory_format" CHECK ("desks"."factory" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "desks_operator_format" CHECK ("desks"."operator" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "desks_salt_format" CHECK ("desks"."salt" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "desks_drawdown_baseline_nonneg" CHECK ("desks"."drawdown_baseline_usdg" >= 0)
);
--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"desk_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "mandate_status" DEFAULT 'draft' NOT NULL,
	"preset" text,
	"targets" jsonb NOT NULL,
	"drift_tolerance_bps" integer NOT NULL,
	"max_position_bps" integer NOT NULL,
	"per_action_cap_usdg" numeric(78, 0) NOT NULL,
	"daily_cap_usdg" numeric(78, 0) NOT NULL,
	"loss_stop_bps" integer NOT NULL,
	"large_action_usdg" numeric(78, 0) NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"compiled_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"read_back" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "mandates_bps_in_range" CHECK ("mandates"."drift_tolerance_bps" between 0 and 10000 and "mandates"."max_position_bps" between 0 and 10000 and "mandates"."loss_stop_bps" between 0 and 10000),
	CONSTRAINT "mandates_per_action_cap_nonneg" CHECK ("mandates"."per_action_cap_usdg" >= 0),
	CONSTRAINT "mandates_daily_cap_nonneg" CHECK ("mandates"."daily_cap_usdg" >= 0),
	CONSTRAINT "mandates_large_action_nonneg" CHECK ("mandates"."large_action_usdg" >= 0)
);
--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"desk_id" uuid NOT NULL,
	"status" "telegram_link_status" DEFAULT 'pending' NOT NULL,
	"code" text NOT NULL,
	"code_expires_at" timestamp with time zone NOT NULL,
	"telegram_user_id" bigint,
	"telegram_chat_id" bigint,
	"telegram_username" text,
	"status_message_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"linked_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "company_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "company_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"token" text NOT NULL,
	"symbol" text NOT NULL,
	"kind" "company_event_kind" NOT NULL,
	"event_date" date NOT NULL,
	"timing" text,
	"source" text NOT NULL,
	"payload" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_events_token_format" CHECK ("company_events"."token" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "desk_token_flags" (
	"desk_id" uuid NOT NULL,
	"token" text NOT NULL,
	"flag" "token_flag" NOT NULL,
	"active" boolean NOT NULL,
	"since" timestamp with time zone DEFAULT now() NOT NULL,
	"cleared_at" timestamp with time zone,
	"last_alerted_at" timestamp with time zone,
	"detail" jsonb,
	CONSTRAINT "desk_token_flags_desk_id_token_flag_pk" PRIMARY KEY("desk_id","token","flag"),
	CONSTRAINT "desk_token_flags_token_format" CHECK ("desk_token_flags"."token" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "multiplier_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "multiplier_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"token" text NOT NULL,
	"kind" "multiplier_event_kind" NOT NULL,
	"old_multiplier_raw" numeric(78, 0) NOT NULL,
	"new_multiplier_raw" numeric(78, 0) NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "multiplier_events_token_format" CHECK ("multiplier_events"."token" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "multiplier_events_tx_hash_format" CHECK ("multiplier_events"."tx_hash" ~ '^0x[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "news_cache" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "news_cache_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"symbol" text NOT NULL,
	"url_hash" text NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"title_hash" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_cache_url_hash_format" CHECK ("news_cache"."url_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "news_cache_title_hash_format" CHECK ("news_cache"."title_hash" ~ '^0x[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "price_points" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "price_points_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"token" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"block_number" bigint,
	"pool_mid_e8" numeric(78, 0),
	"twap30_e8" numeric(78, 0),
	"feed_price_e8" numeric(78, 0),
	"feed_updated_at" timestamp with time zone,
	"gap_bps" integer,
	"cost_bps_100" integer,
	"cost_bps_1000" integer,
	"halted" boolean,
	"oracle_paused" boolean,
	CONSTRAINT "price_points_token_format" CHECK ("price_points"."token" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "reference_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reference_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"token" text NOT NULL,
	"kind" "reference_kind" NOT NULL,
	"session_date" date NOT NULL,
	"boundary_at" timestamp with time zone NOT NULL,
	"price_e8" numeric(78, 0) NOT NULL,
	"multiplier_raw" numeric(78, 0) NOT NULL,
	"tx_hash" text,
	"block_number" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reference_snapshots_token_format" CHECK ("reference_snapshots"."token" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "reference_snapshots_tx_hash_format" CHECK ("reference_snapshots"."tx_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "reference_snapshots_price_nonneg" CHECK ("reference_snapshots"."price_e8" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cash_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"desk_id" uuid NOT NULL,
	"kind" "cash_flow_kind" NOT NULL,
	"status" "cash_flow_status" DEFAULT 'confirmed' NOT NULL,
	"token" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"usdg_value" numeric(78, 0),
	"tx_hash" text,
	"log_index" integer,
	"block_number" bigint,
	"relay_request_id" text,
	"origin_chain_id" integer,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "cash_flows_token_format" CHECK ("cash_flows"."token" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "cash_flows_tx_hash_format" CHECK ("cash_flows"."tx_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "cash_flows_amount_nonneg" CHECK ("cash_flows"."amount" >= 0),
	CONSTRAINT "cash_flows_usdg_value_nonneg" CHECK ("cash_flows"."usdg_value" >= 0),
	CONSTRAINT "cash_flows_is_traceable" CHECK ("cash_flows"."tx_hash" is not null or "cash_flows"."relay_request_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "desk_value_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "desk_value_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"desk_id" uuid NOT NULL,
	"kind" "value_snapshot_kind" NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"total_usdg" numeric(78, 0) NOT NULL,
	"cash_usdg" numeric(78, 0) NOT NULL,
	"vault_usdg" numeric(78, 0) NOT NULL,
	"holdings" jsonb NOT NULL,
	"price_source" text NOT NULL,
	"block_number" bigint,
	CONSTRAINT "desk_value_snapshots_total_nonneg" CHECK ("desk_value_snapshots"."total_usdg" >= 0),
	CONSTRAINT "desk_value_snapshots_cash_nonneg" CHECK ("desk_value_snapshots"."cash_usdg" >= 0),
	CONSTRAINT "desk_value_snapshots_vault_nonneg" CHECK ("desk_value_snapshots"."vault_usdg" >= 0)
);
--> statement-breakpoint
CREATE TABLE "fee_accruals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fee_accruals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"desk_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"basis_usdg" numeric(78, 0) NOT NULL,
	"rate_bps" integer NOT NULL,
	"amount_usdg" numeric(78, 0) NOT NULL,
	"waived" boolean DEFAULT true NOT NULL,
	CONSTRAINT "fee_accruals_period_order" CHECK ("fee_accruals"."period_end" > "fee_accruals"."period_start"),
	CONSTRAINT "fee_accruals_basis_nonneg" CHECK ("fee_accruals"."basis_usdg" >= 0),
	CONSTRAINT "fee_accruals_amount_nonneg" CHECK ("fee_accruals"."amount_usdg" >= 0)
);
--> statement-breakpoint
CREATE TABLE "disclosure_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"version" text NOT NULL,
	"not_restricted" boolean NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disclosure_acceptances_declared" CHECK ("disclosure_acceptances"."not_restricted")
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"note" text,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_uses_within_max" CHECK ("invite_codes"."uses" >= 0 and "invite_codes"."uses" <= "invite_codes"."max_uses")
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"timezone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "owners_address_format" CHECK ("owners"."address" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"desk_id" uuid NOT NULL,
	"decision_id" uuid,
	"kind" "notification_kind" NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"dedupe_key" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"telegram_message_id" bigint,
	"send_after" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "serv_calls" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "serv_calls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"desk_id" uuid,
	"wake_id" uuid,
	"decision_id" uuid,
	"purpose" text NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"mode" "serv_mode" NOT NULL,
	"ok" boolean NOT NULL,
	"error" text,
	"rejected_by_our_checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"latency_ms" integer NOT NULL,
	"total_tokens" integer,
	"finish_reason" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_answered_by_owners_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_execution_decision_id_decisions_id_fk" FOREIGN KEY ("execution_decision_id") REFERENCES "public"."decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_wake_id_wakes_id_fk" FOREIGN KEY ("wake_id") REFERENCES "public"."wakes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deferrals" ADD CONSTRAINT "deferrals_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deferrals" ADD CONSTRAINT "deferrals_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wakes" ADD CONSTRAINT "wakes_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desk_events" ADD CONSTRAINT "desk_events_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desks" ADD CONSTRAINT "desks_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desks" ADD CONSTRAINT "desks_invite_code_invite_codes_code_fk" FOREIGN KEY ("invite_code") REFERENCES "public"."invite_codes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desk_token_flags" ADD CONSTRAINT "desk_token_flags_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desk_value_snapshots" ADD CONSTRAINT "desk_value_snapshots_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_accruals" ADD CONSTRAINT "fee_accruals_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disclosure_acceptances" ADD CONSTRAINT "disclosure_acceptances_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serv_calls" ADD CONSTRAINT "serv_calls_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serv_calls" ADD CONSTRAINT "serv_calls_wake_id_wakes_id_fk" FOREIGN KEY ("wake_id") REFERENCES "public"."wakes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serv_calls" ADD CONSTRAINT "serv_calls_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "actions_decision_leg_key" ON "actions" USING btree ("decision_id","leg");--> statement-breakpoint
CREATE UNIQUE INDEX "actions_tx_hash_key" ON "actions" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "actions_unresolved_idx" ON "actions" USING btree ("status","planned_at") WHERE "actions"."status" in ('planned', 'prepared', 'sent');--> statement-breakpoint
CREATE INDEX "actions_desk_idx" ON "actions" USING btree ("desk_id","planned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_decision_key" ON "approvals" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "approvals_pending_idx" ON "approvals" USING btree ("desk_id","expires_at") WHERE "approvals"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "decisions_desk_seq_key" ON "decisions" USING btree ("desk_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "decisions_record_hash_key" ON "decisions" USING btree ("record_hash");--> statement-breakpoint
CREATE INDEX "decisions_desk_decided_idx" ON "decisions" USING btree ("desk_id","decided_at");--> statement-breakpoint
CREATE INDEX "decisions_desk_outcome_idx" ON "decisions" USING btree ("desk_id","outcome");--> statement-breakpoint
CREATE INDEX "decisions_unsealed_idx" ON "decisions" USING btree ("desk_id","seq") WHERE "decisions"."sealed_by_tx" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "deferrals_one_standing_key" ON "deferrals" USING btree ("desk_id","token") WHERE "deferrals"."status" = 'standing';--> statement-breakpoint
CREATE INDEX "deferrals_revisit_idx" ON "deferrals" USING btree ("revisit_at") WHERE "deferrals"."status" = 'standing';--> statement-breakpoint
CREATE UNIQUE INDEX "grades_decision_key" ON "grades" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "grades_desk_graded_idx" ON "grades" USING btree ("desk_id","graded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wakes_desk_scheduled_key" ON "wakes" USING btree ("desk_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "wakes_desk_started_idx" ON "wakes" USING btree ("desk_id","started_at");--> statement-breakpoint
CREATE INDEX "desk_events_desk_at_idx" ON "desk_events" USING btree ("desk_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "desks_chain_address_key" ON "desks" USING btree ("chain_id","address");--> statement-breakpoint
CREATE UNIQUE INDEX "desks_share_slug_key" ON "desks" USING btree ("share_slug");--> statement-breakpoint
CREATE INDEX "desks_owner_idx" ON "desks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "desks_running_idx" ON "desks" USING btree ("lifecycle","state");--> statement-breakpoint
CREATE UNIQUE INDEX "mandates_desk_version_key" ON "mandates" USING btree ("desk_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "mandates_one_applied_key" ON "mandates" USING btree ("desk_id") WHERE "mandates"."status" = 'applied';--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_links_code_key" ON "telegram_links" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_links_one_linked_key" ON "telegram_links" USING btree ("desk_id") WHERE "telegram_links"."status" = 'linked';--> statement-breakpoint
CREATE INDEX "telegram_links_user_idx" ON "telegram_links" USING btree ("telegram_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_events_token_kind_date_key" ON "company_events" USING btree ("token","kind","event_date");--> statement-breakpoint
CREATE INDEX "company_events_date_idx" ON "company_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "desk_token_flags_active_idx" ON "desk_token_flags" USING btree ("desk_id") WHERE "desk_token_flags"."active";--> statement-breakpoint
CREATE UNIQUE INDEX "multiplier_events_tx_log_key" ON "multiplier_events" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "multiplier_events_token_at_idx" ON "multiplier_events" USING btree ("token","at");--> statement-breakpoint
CREATE UNIQUE INDEX "news_cache_symbol_url_key" ON "news_cache" USING btree ("symbol","url_hash");--> statement-breakpoint
CREATE INDEX "news_cache_symbol_published_idx" ON "news_cache" USING btree ("symbol","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "price_points_token_at_key" ON "price_points" USING btree ("token","at");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_snapshots_token_kind_date_key" ON "reference_snapshots" USING btree ("token","kind","session_date");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_flows_tx_log_key" ON "cash_flows" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_flows_relay_request_key" ON "cash_flows" USING btree ("relay_request_id");--> statement-breakpoint
CREATE INDEX "cash_flows_desk_detected_idx" ON "cash_flows" USING btree ("desk_id","detected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "desk_value_snapshots_desk_kind_taken_key" ON "desk_value_snapshots" USING btree ("desk_id","kind","taken_at");--> statement-breakpoint
CREATE INDEX "desk_value_snapshots_desk_taken_idx" ON "desk_value_snapshots" USING btree ("desk_id","taken_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_accruals_desk_period_key" ON "fee_accruals" USING btree ("desk_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "disclosure_acceptances_owner_version_key" ON "disclosure_acceptances" USING btree ("owner_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "owners_address_key" ON "owners" USING btree ("address");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_key" ON "notifications" USING btree ("desk_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_pending_idx" ON "notifications" USING btree ("send_after") WHERE "notifications"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "serv_calls_at_idx" ON "serv_calls" USING btree ("at");--> statement-breakpoint
CREATE INDEX "serv_calls_purpose_at_idx" ON "serv_calls" USING btree ("purpose","at");