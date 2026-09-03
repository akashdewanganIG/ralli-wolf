
CREATE TYPE "Region" AS ENUM ('SOUTH', 'NORTH', 'EAST', 'WEST_1', 'WEST_2', 'APTOC');


ALTER TABLE "users" ADD COLUMN "region" "Region";


CREATE INDEX "users_region_idx" ON "users"("region");

