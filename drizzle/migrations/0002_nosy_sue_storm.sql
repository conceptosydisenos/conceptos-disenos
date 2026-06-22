ALTER TABLE "quotes" ADD COLUMN "tax_percentage" numeric(5, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "tax_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL;