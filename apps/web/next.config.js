import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/*
 * The browser has to reach the API on this app's own origin. Web and API run on
 * separate hosts in production, and under the Public Suffix List those count as
 * different sites, so a SameSite=Strict session cookie set by the API is
 * dropped by the browser. Forwarding /api/* from here keeps every request
 * same-origin and the cookie intact.
 *
 * Set API_PROXY_TARGET to the API's origin (server-side only, not inlined).
 * Leave it unset locally to keep calling the API host directly.
 */
async function rewrites() {
  const target = process.env.API_PROXY_TARGET?.trim().replace(/\/+$/, "");
  if (!target) return [];
  return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
}

const nextConfig = {
  distDir: ".next",

  rewrites,

  transpilePackages: ["@repo/ui"],

  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },

  images: {
    formats: ["image/webp", "image/avif"],

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
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "**.r2.dev",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.digitaloceanspaces.com",
        pathname: "/**",
      },
    ],

    unoptimized: true,
  },

  serverExternalPackages: [],

  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
