import type { NextConfig } from "next";

/**
 * Private network addresses, so a phone on the same Wi-Fi can open the dev server
 * at http://<laptop-ip>:3000 with live reload. Only affects `next dev`.
 */
const LAN_ORIGINS = ["192.168.*.*", "10.*.*.*", ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`), "*.local"];

/**
 * Firebase's sign-in helper pages, served from this site's own address
 * (/__/auth/…) instead of <project>.firebaseapp.com. Signing in with Google or
 * Apple then works in browsers that block third-party cookies (often work and
 * school computers, and Safari). It takes effect once NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 * is this site's own domain (FIREBASE_SETUP.md, "Sign-in that works everywhere").
 */
const FIREBASE_HOST = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com` : null;

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle for the Docker image. Unused on Vercel.
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  allowedDevOrigins: LAN_ORIGINS,
  async rewrites() {
    if (!FIREBASE_HOST) return [];
    return [{ source: "/__/auth/:path*", destination: `${FIREBASE_HOST}/__/auth/:path*` }];
  },
};

export default nextConfig;
