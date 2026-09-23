ALTER TABLE "check_requests" ADD COLUMN IF NOT EXISTS "openserv_workspace" text;--> statement-breakpoint
ALTER TABLE "check_requests" ADD COLUMN IF NOT EXISTS "openserv_task_id" text;--> statement-breakpoint
ALTER TABLE "check_requests" ADD COLUMN IF NOT EXISTS "openserv_execution_id" text;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN IF NOT EXISTS "openserv_workspace" text;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN IF NOT EXISTS "openserv_task_id" text;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN IF NOT EXISTS "openserv_execution_id" text;--> statement-breakpoint
ALTER TABLE "openserv_links" ADD COLUMN IF NOT EXISTS "workspace_name" text;--> statement-breakpoint
ALTER TABLE "openserv_links" ADD COLUMN IF NOT EXISTS "allow_checks" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "openserv_links" ADD COLUMN IF NOT EXISTS "webhook_url_enc" text;