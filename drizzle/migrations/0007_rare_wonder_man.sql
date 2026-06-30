ALTER TABLE "clients" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contractors" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;