-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "pdf_url" TEXT NOT NULL,
    "uploaded_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_uploaded_by_idx" ON "invoices"("uploaded_by");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "subdealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
