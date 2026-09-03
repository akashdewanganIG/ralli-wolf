import assert from "node:assert/strict";
import test from "node:test";

import { WhatsappSendService } from "../src/services/whatsapp/send-service.js";

type MediaMaterializer = {
  materializeHeaderMedia: (
    variables: Record<string, unknown>,
    templateData: Record<string, unknown>,
    signedUrls: Map<string, Promise<string>>
  ) => Promise<void>;
};

function materialize(variables: Record<string, unknown>) {
  const service = new WhatsappSendService() as unknown as MediaMaterializer;
  return service.materializeHeaderMedia(
    variables,
    { components: [{ type: "HEADER", format: "IMAGE" }] },
    new Map()
  );
}

test("WhatsApp media materialization validates legacy object links", async () => {
  const variables = {
    header_1: {
      type: "image",
      image: { link: "https://cdn.example.com/campaign/image.png" },
    },
  };

  await materialize(variables);

  assert.deepEqual(variables.header_1, {
    type: "image",
    image: { link: "https://cdn.example.com/campaign/image.png" },
  });
});

test("WhatsApp media materialization rejects object payload validation bypasses", async () => {
  await assert.rejects(
    materialize({
      header_1: {
        type: "image",
        image: { link: "http://169.254.169.254/latest/meta-data" },
      },
    }),
    /public HTTPS hostname/
  );

  await assert.rejects(
    materialize({
      header_1: {
        type: "video",
        video: { link: "https://cdn.example.com/video.mp4" },
      },
    }),
    /valid image header_1 media/
  );
});

test("WhatsApp media materialization rejects ambiguous or unsafe references", async () => {
  await assert.rejects(
    materialize({
      header_1: {
        type: "image",
        image: {
          id: "s3://whatsapp-campaign/upload.png",
          link: "https://cdn.example.com/upload.png",
        },
      },
    }),
    /one image media reference/
  );

  await assert.rejects(
    materialize({ header_1: "s3://other-folder/upload.png" }),
    /invalid private media reference/
  );
});
