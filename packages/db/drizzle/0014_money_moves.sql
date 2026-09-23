DO $$ BEGIN
 CREATE TYPE "public"."money_move_kind" AS ENUM('fund', 'withdraw', 'sell_some', 'send', 'bridge_in', 'bridge_out', 'get_gas');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."money_move_status" AS ENUM('signing', 'approved_only', 'on_its_way', 'done', 'nothing_sent', 'may_have_been_sent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "money_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"desk_id" uuid,
	"kind" "money_move_kind" NOT NULL,
	"status" "money_move_status" DEFAULT 'signing' NOT NULL,
	"from_chain_id" integer NOT NULL,
	"to_chain_id" integer NOT NULL,
	"token_in" text NOT NULL,
	"amount_in" numeric(78, 0) NOT NULL,
	"token_out" text NOT NULL,
	"amount_out_quoted" numeric(78, 0),
	"amount_out_actual" numeric(78, 0),
	"usdg_value" numeric(78, 0),
	"fee_usdg" numeric(78, 0),
	"recipient" text NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tx_hashes" text[] DEFAULT '{}'::text[] NOT NULL,
	"relay_request_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "money_moves_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id"),
	CONSTRAINT "money_moves_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id"),
	CONSTRAINT "money_moves_token_in_format" CHECK ("token_in" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "money_moves_token_out_format" CHECK ("token_out" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "money_moves_recipient_format" CHECK ("recipient" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "money_moves_amount_in_nonneg" CHECK ("amount_in" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "money_moves_owner_created_idx" ON "money_moves" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "money_moves_desk_created_idx" ON "money_moves" USING btree ("desk_id","created_at");--> statement-breakpoint
ALTER TABLE "desk_value_snapshots" ADD COLUMN IF NOT EXISTS "flows_usdg" numeric(78, 0) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_flows" ADD COLUMN IF NOT EXISTS "money_move_id" uuid;--> statement-breakpoint
ALTER TABLE "cash_flows" ADD COLUMN IF NOT EXISTS "snapshot_id" bigint;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_money_move_id_money_moves_id_fk" FOREIGN KEY ("money_move_id") REFERENCES "public"."money_moves"("id");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_snapshot_id_desk_value_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."desk_value_snapshots"("id");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "cash_flows" DROP CONSTRAINT IF EXISTS "cash_flows_is_traceable";--> statement-breakpoint
ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_is_traceable" CHECK ("tx_hash" is not null or "relay_request_id" is not null or "snapshot_id" is not null);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cash_flows_snapshot_token_key" ON "cash_flows" USING btree ("snapshot_id","token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_flows_money_move_idx" ON "cash_flows" USING btree ("money_move_id");--> statement-breakpoint
-- Backfill. Reconcile writes the "changed outside" event and the snapshot that absorbs it in one transaction, and
-- the snapshot's time is taken before that transaction starts, so each event belongs to its desk's newest snapshot
-- at or before it. Every snapshot's running total is the sum of the events that belong to it or to an earlier one.
-- A change that could not be priced carries no dollar value and adds nothing, as it did to the baseline.
WITH ev AS (
	SELECT e.id, e.desk_id, e.detail,
		COALESCE((SELECT sum((c->>'usdgValue')::numeric) FROM jsonb_array_elements(e.detail->'changes') c WHERE c->>'usdgValue' IS NOT NULL), 0) AS flow,
		(SELECT s.id FROM desk_value_snapshots s WHERE s.desk_id = e.desk_id AND s.taken_at <= e.at ORDER BY s.taken_at DESC, s.id DESC LIMIT 1) AS snapshot_id
	FROM desk_events e
	WHERE e.kind = 'holdings_changed_outside'
),
placed AS (
	SELECT ev.*, s.taken_at FROM ev JOIN desk_value_snapshots s ON s.id = ev.snapshot_id
),
totals AS (
	SELECT s.id, sum(p.flow) AS total
	FROM desk_value_snapshots s JOIN placed p ON p.desk_id = s.desk_id AND p.taken_at <= s.taken_at
	GROUP BY s.id
)
UPDATE desk_value_snapshots s SET flows_usdg = totals.total FROM totals WHERE s.id = totals.id;--> statement-breakpoint
-- From here on a snapshot written without a running total carries the previous one forward: nothing moved. The
-- default of 0 would restart the total at every hourly snapshot (and a worker still on older code writes none).
ALTER TABLE "desk_value_snapshots" ALTER COLUMN "flows_usdg" DROP DEFAULT;--> statement-breakpoint
CREATE OR REPLACE FUNCTION desk_value_snapshots_carry_flows() RETURNS trigger AS $$
BEGIN
	IF NEW.flows_usdg IS NULL THEN
		NEW.flows_usdg := COALESCE((
			SELECT s.flows_usdg FROM desk_value_snapshots s
			WHERE s.desk_id = NEW.desk_id AND s.taken_at < NEW.taken_at
			ORDER BY s.taken_at DESC, s.id DESC LIMIT 1
		), 0);
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS desk_value_snapshots_carry_flows ON desk_value_snapshots;--> statement-breakpoint
CREATE TRIGGER desk_value_snapshots_carry_flows BEFORE INSERT ON desk_value_snapshots
	FOR EACH ROW EXECUTE FUNCTION desk_value_snapshots_carry_flows();--> statement-breakpoint
-- One money row per past change, tied to the snapshot that found it, so the record and the charts can mark it.
INSERT INTO cash_flows (desk_id, kind, status, token, amount, usdg_value, snapshot_id, detected_at, confirmed_at)
SELECT e.desk_id,
	(CASE WHEN (c->>'delta')::numeric > 0 THEN 'deposit' ELSE 'withdrawal' END)::cash_flow_kind,
	'confirmed',
	CASE c->>'asset'
		WHEN 'USDG' THEN '0x5fc5360d0400a0fd4f2af552add042d716f1d168'
		WHEN 'VAULT' THEN '0xbeeff033f34c046626b8d0a041844c5d1a5409dd'
		ELSE lower(c->>'asset')
	END,
	abs((c->>'delta')::numeric),
	CASE WHEN c->>'usdgValue' IS NULL THEN NULL ELSE abs((c->>'usdgValue')::numeric) END,
	(SELECT s.id FROM desk_value_snapshots s WHERE s.desk_id = e.desk_id AND s.taken_at <= e.at ORDER BY s.taken_at DESC, s.id DESC LIMIT 1),
	e.at,
	e.at
FROM desk_events e, jsonb_array_elements(e.detail->'changes') c
WHERE e.kind = 'holdings_changed_outside'
	AND (c->>'delta')::numeric <> 0
	AND EXISTS (SELECT 1 FROM desk_value_snapshots s WHERE s.desk_id = e.desk_id AND s.taken_at <= e.at)
ON CONFLICT DO NOTHING;
