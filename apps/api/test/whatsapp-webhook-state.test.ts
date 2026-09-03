import assert from "node:assert/strict";
import test from "node:test";

import { CampaignDeliveryStatus } from "@prisma/client";

import {
  isWhatsAppOptOutCommand,
  mapMsg91DeliveryStatus,
  shouldApplyDeliveryStatus,
} from "../src/services/whatsapp/webhook-service.js";

test("only explicit opt-out commands unsubscribe a recipient", () => {
  assert.equal(isWhatsAppOptOutCommand(" STOP! "), true);
  assert.equal(isWhatsAppOptOutCommand("opt   out"), true);
  assert.equal(isWhatsAppOptOutCommand("Please stop sending these"), false);
  assert.equal(isWhatsAppOptOutCommand("do not stop updates"), false);
});

test("unknown MSG91 events do not mutate delivery state", () => {
  assert.equal(mapMsg91DeliveryStatus("provider_health"), null);
  assert.deepEqual(mapMsg91DeliveryStatus("DELIVERED"), {
    status: CampaignDeliveryStatus.DELIVERED,
    label: "delivered",
  });
});

test("delivery progression rejects duplicates and late downgrades", () => {
  assert.equal(
    shouldApplyDeliveryStatus(
      CampaignDeliveryStatus.PROCESSING,
      CampaignDeliveryStatus.SENT
    ),
    true
  );
  assert.equal(
    shouldApplyDeliveryStatus(
      CampaignDeliveryStatus.DELIVERED,
      CampaignDeliveryStatus.FAILED
    ),
    false
  );
  assert.equal(
    shouldApplyDeliveryStatus(
      CampaignDeliveryStatus.READ,
      CampaignDeliveryStatus.DELIVERED
    ),
    false
  );
  assert.equal(
    shouldApplyDeliveryStatus(
      CampaignDeliveryStatus.READ,
      CampaignDeliveryStatus.READ
    ),
    false
  );
  assert.equal(
    shouldApplyDeliveryStatus(
      CampaignDeliveryStatus.READ,
      CampaignDeliveryStatus.OPTED_OUT
    ),
    true
  );
});
