ALTER TABLE "sensor_events"
ADD CONSTRAINT "sensor_events_sequence_non_negative"
CHECK ("sequence" >= 0);
