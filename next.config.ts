import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Work around Phoenix ESM parsing issue in current Windows toolchain.
      "@supabase/phoenix$": path.resolve(
        process.cwd(),
        "node_modules/@supabase/phoenix/priv/static/phoenix.cjs.js",
      ),
    };

    return config;
  },
};

export default nextConfig;
