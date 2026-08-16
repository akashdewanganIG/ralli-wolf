/*
  Warnings:

  - The values [NEEDS_REVISION,DENIED] on the enum `QuoteStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "ApprovalTargetObject" AS ENUM ('OPP', 'QUOTE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
BEGIN;
CREATE TYPE "QuoteStatus_new" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PRESENTED', 'ACCEPTED');
ALTER TABLE "quotes" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "quotes" ALTER COLUMN "status" TYPE "QuoteStatus_new" USING ("status"::text::"QuoteStatus_new");
ALTER TYPE "QuoteStatus" RENAME TO "QuoteStatus_old";
ALTER TYPE "QuoteStatus_new" RENAME TO "QuoteStatus";
DROP TYPE "QuoteStatus_old";
ALTER TABLE "quotes" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "pdf_url" TEXT;

-- CreateTable
CREATE TABLE "approval_processes" (
    "id" SERIAL NOT NULL,
    "targetObjectName" "ApprovalTargetObject" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "target_record_id" INTEGER NOT NULL,
    "requested_to_id" INTEGER NOT NULL,
    "last_actor_id" INTEGER,
    "created_by_id" INTEGER NOT NULL,
    "completed_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_processes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_processes_targetObjectName_target_record_id_idx" ON "approval_processes"("targetObjectName", "target_record_id");

-- CreateIndex
CREATE INDEX "approval_processes_requested_to_id_idx" ON "approval_processes"("requested_to_id");

-- CreateIndex
CREATE INDEX "approval_processes_created_by_id_idx" ON "approval_processes"("created_by_id");

-- CreateIndex
CREATE INDEX "approval_processes_status_idx" ON "approval_processes"("status");

-- AddForeignKey
ALTER TABLE "approval_processes" ADD CONSTRAINT "approval_processes_requested_to_id_fkey" FOREIGN KEY ("requested_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_processes" ADD CONSTRAINT "approval_processes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_processes" ADD CONSTRAINT "approval_processes_last_actor_id_fkey" FOREIGN KEY ("last_actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
