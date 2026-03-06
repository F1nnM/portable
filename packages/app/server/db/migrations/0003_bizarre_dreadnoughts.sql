ALTER TABLE "projects" ALTER COLUMN "scaffold_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "scaffold_id" DROP NOT NULL;