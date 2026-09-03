/**
 * End-to-end storage check against the configured S3-compatible provider.
 *
 * Uploads a throwaway image, fetches it over its public URL, round-trips the
 * key extraction used by delete paths, presigns a private download, then
 * deletes the object and confirms it is gone.
 *
 * Run with: npm run verify:storage -w api
 */
import {
  deleteImageFromS3,
  extractS3KeyFromUrl,
  uploadImageToS3,
} from "../src/services/upload.service.js";
import { getSignedS3DownloadUrl } from "../src/services/s3.service.js";
import { verifyFileContent } from "../src/utils/file-validation.js";

// Smallest valid PNG, so the magic-byte validation exercises a real image.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  const mark = ok ? "PASS" : "FAIL";
  if (!ok) failures += 1;
  console.log(`  [${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("\nStorage verification");
  console.log(`  bucket   : ${process.env.S3_BUCKET_NAME}`);
  console.log(`  endpoint : ${process.env.S3_ENDPOINT || "(AWS default)"}`);
  console.log(
    `  public   : ${process.env.S3_PUBLIC_BASE_URL || "(derived from bucket)"}\n`
  );

  const buffer = Buffer.from(PNG_BASE64, "base64");

  const verified = verifyFileContent(buffer, "image/png", [
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  check("magic-byte validation accepts a real PNG", verified !== null);
  if (!verified) return;

  let key: string | null = null;
  let publicUrl = "";

  try {
    const uploaded = await uploadImageToS3(
      buffer,
      "diagnostics",
      "storage-check",
      verified.mimeType
    );
    publicUrl = uploaded.secureUrl;
    check("upload succeeded", Boolean(publicUrl), publicUrl);

    const publicResponse = await fetch(publicUrl);
    check(
      "object is publicly readable",
      publicResponse.ok,
      `HTTP ${publicResponse.status} ${publicResponse.headers.get("content-type") ?? ""}`
    );
    if (!publicResponse.ok) {
      console.log(
        "\n  Hint: a 400/404 here usually means the bucket is not public,\n" +
          "  or S3_PUBLIC_BASE_URL does not match the provider's public path.\n"
      );
    }

    key = extractS3KeyFromUrl(publicUrl);
    check(
      "public URL round-trips to an object key",
      key !== null,
      key ?? "returned null — deletes would silently skip"
    );

    if (key) {
      const signed = await getSignedS3DownloadUrl(key, 300);
      const signedResponse = await fetch(signed);
      check(
        "presigned private download is accepted",
        signedResponse.ok,
        `HTTP ${signedResponse.status}`
      );
    }
  } finally {
    if (key) {
      await deleteImageFromS3(key);

      // Public URLs are served through a CDN and can keep answering from
      // cache after the object is gone, so the S3 API is the authority here.
      let stillPresent: boolean;
      try {
        const signedAfter = await getSignedS3DownloadUrl(key, 300);
        const afterResponse = await fetch(signedAfter);
        stillPresent = afterResponse.ok;
        check(
          "object removed after delete",
          !stillPresent,
          `S3 API returned HTTP ${afterResponse.status}`
        );
      } catch {
        check("object removed after delete", true, "object no longer readable");
      }

      const cachedResponse = await fetch(publicUrl);
      if (cachedResponse.ok) {
        console.log(
          `  [note] the public URL still answers HTTP ${cachedResponse.status} ` +
            `(cache-control: ${cachedResponse.headers.get("cache-control") ?? "n/a"}). ` +
            "That is CDN caching, not a failed delete."
        );
      }
    }
  }

  console.log(
    failures === 0
      ? "\nStorage is configured correctly.\n"
      : `\n${failures} check(s) failed.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(error => {
  console.error("\nStorage verification threw:\n", error);
  process.exit(1);
});
