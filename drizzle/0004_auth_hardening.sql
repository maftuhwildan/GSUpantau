ALTER TABLE "users" ADD COLUMN "assigned_line_id" uuid;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_assigned_line_id_lines_id_fk" FOREIGN KEY ("assigned_line_id") REFERENCES "public"."lines"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_user_id_role_id_unique" ON "user_roles" USING btree ("user_id","role_id");
