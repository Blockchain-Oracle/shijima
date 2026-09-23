CREATE TABLE IF NOT EXISTS "telegram_owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" "telegram_link_status" DEFAULT 'pending' NOT NULL,
	"code" text NOT NULL,
	"code_expires_at" timestamp with time zone NOT NULL,
	"telegram_user_id" bigint,
	"telegram_chat_id" bigint,
	"telegram_username" text,
	"current_desk_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"linked_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "telegram_owners_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id"),
	CONSTRAINT "telegram_owners_current_desk_id_desks_id_fk" FOREIGN KEY ("current_desk_id") REFERENCES "public"."desks"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_owners_code_key" ON "telegram_owners" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_owners_one_linked_key" ON "telegram_owners" USING btree ("owner_id") WHERE "telegram_owners"."status" = 'linked';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_owners_user_idx" ON "telegram_owners" USING btree ("telegram_user_id");
