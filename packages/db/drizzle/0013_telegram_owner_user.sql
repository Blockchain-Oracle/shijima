CREATE UNIQUE INDEX IF NOT EXISTS "telegram_owners_one_user_key" ON "telegram_owners" USING btree ("telegram_user_id") WHERE "telegram_owners"."status" = 'linked';
