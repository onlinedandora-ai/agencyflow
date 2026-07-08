import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Monorepo: resolve deps from repo root (fixes Turbopack module resolution)
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
