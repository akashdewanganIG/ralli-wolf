import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Derive __dirname in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env file
// This allows us to use a centralized .env for the entire monorepo
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // CI/verification can use an isolated output directory while a developer
  // keeps `next dev` running against the normal `.next` cache.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Ensure shared client packages are transpiled by Next/Turbopack.
  transpilePackages: ["@repo/ui", "lucide-react"],

  // Optimize package imports for better tree-shaking
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  // Image optimization configuration
  images: {
    // Enable image optimization with Sharp (works perfectly on Vercel)
    formats: ["image/webp", "image/avif"],
    // Configure remote patterns for external images (S3, Cloudinary, etc.)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.s3.*.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
    // Sharp-based on-the-fly optimization doesn't run on Cloudflare Workers.
    // Serve images as-is (still works everywhere, just no server resizing)
    // unless/until a Cloudflare Images loader is wired up.
    unoptimized: true,
  },

  // Server configuration
  serverExternalPackages: [],

  // Ignore TypeScript errors during builds (optional, but recommended for CI)
  typescript: {
    ignoreBuildErrors: false, // Keep this as false to catch TS errors
  },
};

export default nextConfig;
