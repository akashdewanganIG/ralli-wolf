CREATE TABLE "scheduler_leases" (
  "name" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "leased_until" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scheduler_leases_pkey" PRIMARY KEY ("name")
);

CREATE INDEX "scheduler_leases_leased_until_idx"
ON "scheduler_leases"("leased_until");
