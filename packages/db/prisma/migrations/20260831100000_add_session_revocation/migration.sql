

ALTER TABLE "users"
ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;




ALTER TABLE "password_resets"
ADD COLUMN "completed_at" TIMESTAMP(3);
