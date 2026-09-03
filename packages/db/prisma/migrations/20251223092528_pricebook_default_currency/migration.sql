










ALTER TABLE "price_book_entries" ALTER COLUMN "list_price" SET DATA TYPE DECIMAL(65,30);


ALTER TABLE "price_books" DROP COLUMN "currency_iso_code",
ADD COLUMN     "currency_code" TEXT NOT NULL;


ALTER TABLE "products" DROP COLUMN "price";


CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "country" TEXT,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);


CREATE UNIQUE INDEX "currencies_name_key" ON "currencies"("name");


CREATE UNIQUE INDEX "price_books_price_book_name_key" ON "price_books"("price_book_name");


ALTER TABLE "price_books" ADD CONSTRAINT "price_books_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
