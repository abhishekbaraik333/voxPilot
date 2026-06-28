import type { NextConfig } from "next";

const getDevOrigins = () => {
  const origins = ['localhost', '127.0.0.1'];
  const webhookUrl = process.env.TWILIO_WEBHOOK_BASE_URL;
  if (webhookUrl) {
    try {
      const hostname = new URL(webhookUrl).hostname;
      if (hostname) {
        origins.push(hostname);
        if (hostname.startsWith('www.')) {
          origins.push(hostname.substring(4));
        } else {
          origins.push(`www.${hostname}`);
        }
      }
    } catch {
      // Ignore
    }
  }
  return origins;
};

const nextConfig: NextConfig = {
  allowedDevOrigins: getDevOrigins(),
};

export default nextConfig;
