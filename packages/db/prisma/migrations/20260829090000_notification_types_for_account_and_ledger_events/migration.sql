-- Four events that happened silently until now: an account being switched off,
-- a role changing, a purchase order actually reaching its supplier, and an
-- invoice passing its due date. Each becomes a notification type so it routes
-- through the existing preference system and can be turned off per user.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACCOUNT_DEACTIVATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ROLE_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PURCHASE_ORDER_SENT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INVOICE_OVERDUE';
