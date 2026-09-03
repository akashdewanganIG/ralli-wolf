const MIME_ALIASES: Readonly<Record<string, string>> = {
  "image/jpg": "image/jpeg",
};

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

export interface VerifiedFileContent {
  mimeType: string;
  extension: string;
}

function startsWith(buffer: Buffer, signature: readonly number[]): boolean {
  return (
    buffer.length >= signature.length &&
    signature.every((value, index) => buffer[index] === value)
  );
}

function containsAscii(buffer: Buffer, value: string): boolean {
  return buffer.indexOf(Buffer.from(value, "ascii")) >= 0;
}

function hasPdfSignature(buffer: Buffer): boolean {
  if (!startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return false;

  const tail = buffer.subarray(Math.max(0, buffer.length - 2048));
  return containsAscii(tail, "%%EOF");
}

function hasIsoBaseMediaSignature(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
}

function signatureMatches(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case "image/jpeg":
      return startsWith(buffer, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith(
        buffer,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      );
    case "image/webp":
      return (
        buffer.length >= 16 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP" &&
        ["VP8 ", "VP8L", "VP8X"].includes(buffer.toString("ascii", 12, 16))
      );
    case "application/pdf":
      return hasPdfSignature(buffer);
    case "video/mp4":
    case "video/3gpp":
      return hasIsoBaseMediaSignature(buffer);
    case "application/msword":
      return startsWith(
        buffer,
        [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
      );
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return (
        startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) &&
        containsAscii(buffer, "[Content_Types].xml") &&
        containsAscii(buffer, "word/")
      );
    default:
      return false;
  }
}

export function verifyFileContent(
  buffer: Buffer,
  declaredMimeType: unknown,
  allowedMimeTypes: readonly string[]
): VerifiedFileContent | null {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;

  const declared = String(declaredMimeType || "")
    .trim()
    .toLowerCase();
  const mimeType = MIME_ALIASES[declared] ?? declared;
  const allowed = new Set(
    allowedMimeTypes.map(value => MIME_ALIASES[value] ?? value)
  );
  const extension = MIME_EXTENSIONS[mimeType];

  if (!extension || !allowed.has(mimeType)) return null;
  if (!signatureMatches(buffer, mimeType)) return null;
  return { mimeType, extension };
}

export function decodeBase64File(
  encoded: unknown,
  maxDecodedBytes: number
): Buffer | null {
  if (typeof encoded !== "string" || encoded.length === 0) return null;
  if (!Number.isSafeInteger(maxDecodedBytes) || maxDecodedBytes <= 0) {
    throw new Error("maxDecodedBytes must be a positive safe integer");
  }

  if (
    encoded.length > Math.ceil(maxDecodedBytes / 3) * 4 + 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      encoded
    )
  ) {
    return null;
  }

  const buffer = Buffer.from(encoded, "base64");
  return buffer.length > 0 && buffer.length <= maxDecodedBytes ? buffer : null;
}
