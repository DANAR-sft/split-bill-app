import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Headers for Tesseract.js WASM support on Vercel
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
