-- CreateTable
CREATE TABLE "keywords" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_keywords" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "keyword_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_keywords" (
    "id" SERIAL NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "keyword_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_keywords" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "keyword_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "keywords_name_key" ON "keywords"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lead_keywords_lead_id_keyword_id_key" ON "lead_keywords"("lead_id", "keyword_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_keywords_contact_id_keyword_id_key" ON "contact_keywords"("contact_id", "keyword_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_keywords_account_id_keyword_id_key" ON "account_keywords"("account_id", "keyword_id");

-- AddForeignKey
ALTER TABLE "lead_keywords" ADD CONSTRAINT "lead_keywords_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_keywords" ADD CONSTRAINT "lead_keywords_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_keywords" ADD CONSTRAINT "contact_keywords_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_keywords" ADD CONSTRAINT "contact_keywords_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_keywords" ADD CONSTRAINT "account_keywords_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_keywords" ADD CONSTRAINT "account_keywords_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;
