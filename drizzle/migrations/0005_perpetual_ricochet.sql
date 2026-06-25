ALTER TABLE "invoice_allocations" ADD COLUMN "project_rubro_id" uuid;--> statement-breakpoint
ALTER TABLE "quote_items" ADD COLUMN "quote_rubro_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoice_allocations" ADD CONSTRAINT "invoice_allocations_project_rubro_id_project_rubros_id_fk" FOREIGN KEY ("project_rubro_id") REFERENCES "public"."project_rubros"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_rubro_id_quote_rubros_id_fk" FOREIGN KEY ("quote_rubro_id") REFERENCES "public"."quote_rubros"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
