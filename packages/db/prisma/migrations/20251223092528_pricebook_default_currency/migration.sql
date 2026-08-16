/*
  Warnings:

  - You are about to alter the column `list_price` on the `price_book_entries` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to drop the column `currency_iso_code` on the `price_books` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `products` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[price_book_name]` on the table `price_books` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `currency_code` to the `price_books` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "price_book_entries" ALTER COLUMN "list_price" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "price_books" DROP COLUMN "currency_iso_code",
ADD COLUMN     "currency_code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "price";

-- CreateTable
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "country" TEXT,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "currencies_name_key" ON "currencies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "price_books_price_book_name_key" ON "price_books"("price_book_name");

-- AddForeignKey
ALTER TABLE "price_books" ADD CONSTRAINT "price_books_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
