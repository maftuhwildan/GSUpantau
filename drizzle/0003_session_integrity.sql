CREATE UNIQUE INDEX IF NOT EXISTS "one_active_session_per_receiving" ON "receiving_sessions" USING btree ("receiving_id") WHERE status = 'COUNTING';
