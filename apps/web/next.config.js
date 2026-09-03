import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const nextConfig = {
  distDir: ".next",

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
