import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Monorepo: resolve deps from repo root during local dev only.
  ...(process.env.VERCEL
    ? {}
    : {
        turbopack: {
          root: path.join(__dirname, "../.."),
        },
      }),
};

export default nextConfig;
