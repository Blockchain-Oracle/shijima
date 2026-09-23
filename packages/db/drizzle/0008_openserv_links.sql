ALTER TYPE "public"."event_via" ADD VALUE 'openserv';--> statement-breakpoint
CREATE TABLE "openserv_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"desk_id" uuid NOT NULL,
	"status" "telegram_link_status" DEFAULT 'pending' NOT NULL,
	"code" text NOT NULL,
	"code_expires_at" timestamp with time zone NOT NULL,
	"workspace_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"linked_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "openserv_links" ADD CONSTRAINT "openserv_links_desk_id_desks_id_fk" FOREIGN KEY ("desk_id") REFERENCES "public"."desks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "openserv_links_code_key" ON "openserv_links" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "openserv_links_one_workspace_key" ON "openserv_links" USING btree ("workspace_id") WHERE "openserv_links"."status" = 'linked';--> statement-breakpoint
CREATE INDEX "openserv_links_desk_idx" ON "openserv_links" USING btree ("desk_id");