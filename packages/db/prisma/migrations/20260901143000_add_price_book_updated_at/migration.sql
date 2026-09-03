ALTER TABLE "price_books" ADD COLUMN "updated_at" TIMESTAMP(3);

UPDATE "price_books" SET "updated_at" = "created_at";

ALTER TABLE "price_books" ALTER COLUMN "updated_at" SET NOT NULL;

ALTER TABLE "price_book_entries" ADD COLUMN "updated_at" TIMESTAMP(3);

UPDATE "price_book_entries" SET "updated_at" = "created_at";

ALTER TABLE "price_book_entries" ALTER COLUMN "updated_at" SET NOT NULL;
