CREATE SCHEMA "smoke";
--> statement-breakpoint
CREATE TABLE "smoke"."_placeholder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
