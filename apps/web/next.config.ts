import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'voxpiloto.xyz',
    'www.voxpiloto.xyz',
    '147.93.47.133',
    'localhost',
    '127.0.0.1'
  ],
};

export default nextConfig;
