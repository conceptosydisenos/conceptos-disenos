ALTER TABLE "projects" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;