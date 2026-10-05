CREATE TABLE "ai_usage" (
	"user_id" uuid NOT NULL,
	"day" date DEFAULT (now() at time zone 'Europe/London')::date NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "ai_usage_owner_select" ON "ai_usage" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ai_usage"."user_id" = (select auth.uid()));