import type { NextConfig } from "next";

const localNetworkOrigins = [
  "localhost:3000",
  "127.0.0.1:3000",
  "192.168.*.*:3000",
  "10.*.*.*:3000",
  "172.*.*.*:3000",
];

const configuredServerActionOrigins =
  process.env.SERVER_ACTION_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [...localNetworkOrigins, ...configuredServerActionOrigins],
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
