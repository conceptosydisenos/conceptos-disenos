CREATE TABLE IF NOT EXISTS "project_rubros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"rubro_type" text NOT NULL,
	"name" text NOT NULL,
	"budget_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_rubros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"rubro_type" text NOT NULL,
	"name" text NOT NULL,
	"budget_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_rubros" ADD CONSTRAINT "project_rubros_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_rubros" ADD CONSTRAINT "quote_rubros_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_rubros_project_id_idx" ON "project_rubros" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_rubros_project_type_uq" ON "project_rubros" USING btree ("project_id","rubro_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quote_rubros_quote_id_idx" ON "quote_rubros" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quote_rubros_quote_type_uq" ON "quote_rubros" USING btree ("quote_id","rubro_type");