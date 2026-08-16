-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "company_location" TEXT,
ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "completeness_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "invalid_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "missing_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "quality_score" INTEGER NOT NULL DEFAULT 0;
