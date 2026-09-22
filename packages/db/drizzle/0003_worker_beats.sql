CREATE TABLE "worker_beats" (
	"name" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"beat_at" timestamp with time zone NOT NULL,
	"passes" integer DEFAULT 0 NOT NULL,
	"last_pass_ms" integer,
	"last_error" text,
	"info" jsonb DEFAULT '{}'::jsonb NOT NULL
);
