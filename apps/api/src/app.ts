import express, { type Request } from "express";
import cors from "cors";
import dotenv from "dotenv";

const ROUTE_SCOPED_LARGE_JSON_PATHS = new Set([
  "/api/whatsapp/templates/upload-media",
  "/api/whatsapp/campaigns/upload-media",
]);

function isJsonContentType(contentType: string | undefined): boolean {
  return /^application\/(?:[\w.+-]*\+)?json(?:\s*;|$)/i.test(contentType || "");
}

dotenv.config({ path: "../../.env" });

function configuredBrowserOrigins(): Set<string> {
  const configured =
    process.env.CORS_ALLOWED_ORIGINS?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    "";
  const origins = new Set<string>();
  for (const item of configured
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)) {
    const parsed = new URL(item);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(`Invalid CORS origin: ${item}`);
    }
    origins.add(parsed.origin);
  }
  return origins;
}

export function createApp() {
  const app = express();
  const allowedOrigins = configuredBrowserOrigins();
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || "0");
  if (
    !Number.isSafeInteger(trustProxyHops) ||
    trustProxyHops < 0 ||
    trustProxyHops > 10
  ) {
    throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 10");
  }

  app.disable("x-powered-by");
  if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );
    if (process.env.NODE_ENV === "production") {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    }
    if (req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });

  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ error: "Origin is not allowed" });
    }
    next();
  });
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || allowedOrigins.has(origin));
      },
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "X-Session-Mode",
        "X-Webhook-Secret",
        "X-Webhook-Signature",
        "X-Brevo-Signature",
        "X-Landingi-Signature",
        "X-Hub-Signature-256",
        "X-Signature",
      ],
      credentials: true,
      maxAge: 600,
    })
  );
  app.use(
    express.json({
      limit: "1mb",

      type: request => {
        const req = request as Request;
        const path = (req.originalUrl || req.url).split("?", 1)[0];
        return (
          !ROUTE_SCOPED_LARGE_JSON_PATHS.has(path || "") &&
          isJsonContentType(req.headers["content-type"])
        );
      },
      verify: (req, _res, buffer) => {
        (req as Request).rawBody = Buffer.from(buffer);
      },
    })
  );
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  return app;
}
