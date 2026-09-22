CREATE TABLE "room_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"body" text NOT NULL,
	"holds" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_posts_symbol_format" CHECK ("room_posts"."symbol" ~ '^[A-Z]{1,6}$'),
	CONSTRAINT "room_posts_body_length" CHECK (char_length("room_posts"."body") between 1 and 280)
);
--> statement-breakpoint
CREATE TABLE "takes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"caption" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"holds" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "takes_symbol_format" CHECK ("takes"."symbol" ~ '^[A-Z]{1,6}$'),
	CONSTRAINT "takes_caption_length" CHECK (char_length("takes"."caption") between 1 and 240)
);
--> statement-breakpoint
ALTER TABLE "room_posts" ADD CONSTRAINT "room_posts_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takes" ADD CONSTRAINT "takes_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "room_posts_symbol_idx" ON "room_posts" USING btree ("symbol","created_at");--> statement-breakpoint
CREATE INDEX "room_posts_owner_idx" ON "room_posts" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "takes_created_idx" ON "takes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "takes_owner_idx" ON "takes" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "takes_tags_idx" ON "takes" USING gin ("tags");