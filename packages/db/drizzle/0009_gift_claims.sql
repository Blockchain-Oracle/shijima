CREATE TYPE "public"."gift_status" AS ENUM('queued', 'sending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "gift_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet" text NOT NULL,
	"ip_hash" text NOT NULL,
	"status" "gift_status" DEFAULT 'queued' NOT NULL,
	"usdg_amount" numeric(78, 0) NOT NULL,
	"eth_amount_wei" numeric(78, 0) NOT NULL,
	"usdg_tx" text,
	"eth_tx" text,
	"attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_claims_wallet_format" CHECK ("gift_claims"."wallet" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "gift_claims_usdg_tx_format" CHECK ("gift_claims"."usdg_tx" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "gift_claims_eth_tx_format" CHECK ("gift_claims"."eth_tx" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "gift_claims_usdg_amount_nonneg" CHECK ("gift_claims"."usdg_amount" >= 0),
	CONSTRAINT "gift_claims_eth_amount_nonneg" CHECK ("gift_claims"."eth_amount_wei" >= 0),
	CONSTRAINT "gift_claims_sent_has_both" CHECK ("gift_claims"."status" <> 'sent' or ("gift_claims"."usdg_tx" is not null and "gift_claims"."eth_tx" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "gift_claims_wallet_key" ON "gift_claims" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "gift_claims_ip_idx" ON "gift_claims" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "gift_claims_status_idx" ON "gift_claims" USING btree ("status","created_at");