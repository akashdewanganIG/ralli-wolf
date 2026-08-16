-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "lead_remarks" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "remark" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_remarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_remarks_lead_id_idx" ON "lead_remarks"("lead_id");

-- CreateIndex
CREATE INDEX "lead_remarks_user_id_idx" ON "lead_remarks"("user_id");

-- AddForeignKey
ALTER TABLE "lead_remarks" ADD CONSTRAINT "lead_remarks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_remarks" ADD CONSTRAINT "lead_remarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
