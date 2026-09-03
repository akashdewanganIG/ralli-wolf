


DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "bills_of_materials"
    WHERE "status" = 'ACTIVE'
    GROUP BY "product_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot enforce one active BOM per product: duplicate active BOMs exist',
      HINT = 'Retire all but one active BOM for each product, then retry the migration.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "bills_of_materials"
    WHERE "is_default" = TRUE
    GROUP BY "product_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot enforce one default BOM per product: duplicate defaults exist',
      HINT = 'Choose one default BOM for each product, then retry the migration.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "bom_components"
    GROUP BY "bom_id", "line_number"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot enforce BOM line ordering: duplicate line numbers exist',
      HINT = 'Assign a unique positive line_number within each BOM, then retry the migration.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "bills_of_materials"
    WHERE "output_quantity" <= 0
       OR "labor_cost" < 0
       OR "overhead_cost" < 0
       OR ("effective_from" IS NOT NULL AND "effective_to" IS NOT NULL
           AND "effective_to" < "effective_from")
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot enforce BOM header checks: invalid quantities, costs, or effective dates exist',
      HINT = 'Correct non-positive output quantities, negative costs, and reversed effective windows, then retry.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "bom_components"
    WHERE "line_number" <= 0
       OR "quantity" <= 0
       OR "scrap_percent" < 0
       OR "scrap_percent" > 100
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot enforce BOM component checks: invalid lines, quantities, or scrap percentages exist',
      HINT = 'Correct component data, then retry the migration.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "bom_component_substitutes"
    WHERE "priority" <= 0 OR "conversion_factor" <= 0
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot enforce substitute checks: invalid priority or conversion factors exist',
      HINT = 'Correct substitute data, then retry the migration.';
  END IF;
END
$$;

CREATE UNIQUE INDEX "bills_of_materials_one_active_per_product"
  ON "bills_of_materials"("product_id")
  WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "bills_of_materials_one_default_per_product"
  ON "bills_of_materials"("product_id")
  WHERE "is_default" = TRUE;

CREATE UNIQUE INDEX "bom_components_bom_id_line_number_key"
  ON "bom_components"("bom_id", "line_number");

ALTER TABLE "bills_of_materials"
  ADD CONSTRAINT "bills_of_materials_output_quantity_check"
    CHECK ("output_quantity" > 0),
  ADD CONSTRAINT "bills_of_materials_costs_check"
    CHECK ("labor_cost" >= 0 AND "overhead_cost" >= 0),
  ADD CONSTRAINT "bills_of_materials_effective_dates_check"
    CHECK ("effective_from" IS NULL OR "effective_to" IS NULL OR "effective_to" >= "effective_from");

ALTER TABLE "bom_components"
  ADD CONSTRAINT "bom_components_line_number_check"
    CHECK ("line_number" > 0),
  ADD CONSTRAINT "bom_components_quantity_check"
    CHECK ("quantity" > 0),
  ADD CONSTRAINT "bom_components_scrap_percent_check"
    CHECK ("scrap_percent" >= 0 AND "scrap_percent" <= 100);

ALTER TABLE "bom_component_substitutes"
  ADD CONSTRAINT "bom_component_substitutes_priority_check"
    CHECK ("priority" > 0),
  ADD CONSTRAINT "bom_component_substitutes_conversion_factor_check"
    CHECK ("conversion_factor" > 0);
