ALTER TABLE "budget_items" ADD COLUMN "project_rubro_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_project_rubro_id_project_rubros_id_fk" FOREIGN KEY ("project_rubro_id") REFERENCES "public"."project_rubros"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
