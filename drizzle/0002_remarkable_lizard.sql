ALTER TABLE "sensor_events" ADD COLUMN "boot_id" varchar(100);--> statement-breakpoint
UPDATE "sensor_events"
SET "boot_id" = 'legacy-' || "id"::text
WHERE "boot_id" IS NULL;--> statement-breakpoint
ALTER TABLE "sensor_events" ALTER COLUMN "boot_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "device_boot_sequence_unique" ON "sensor_events" USING btree ("device_id","boot_id","sequence");
