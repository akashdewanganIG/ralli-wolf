-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "country_code" TEXT DEFAULT '+91';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "country_code" TEXT DEFAULT '+91';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "country_code" TEXT DEFAULT '+91';
