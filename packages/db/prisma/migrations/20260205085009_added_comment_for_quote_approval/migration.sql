-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "approval_comment" TEXT,
ADD COLUMN     "rejected_by_id" INTEGER,
ADD COLUMN     "rejection_comment" TEXT;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
