

INSERT INTO "currencies" ("code", "name", "symbol", "country")
VALUES
  ('USD', 'US Dollar', '$', 'United States'),
  ('EUR', 'Euro', '€', 'European Union'),
  ('JPY', 'Japanese Yen', '¥', 'Japan'),
  ('GBP', 'British Pound', '£', 'United Kingdom'),
  ('AUD', 'Australian Dollar', '$', 'Australia'),
  ('CAD', 'Canadian Dollar', '$', 'Canada'),
  ('CHF', 'Swiss Franc', 'CHF', 'Switzerland'),
  ('CNY', 'Chinese Yuan', '¥', 'China'),
  ('INR', 'Indian Rupee', '₹', 'India')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "global_settings" (
  "key",
  "value",
  "description",
  "createdAt",
  "updatedAt"
)
VALUES (
  'defaultCurrency',
  'INR',
  'Default currency used for new workspace pricing records',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
