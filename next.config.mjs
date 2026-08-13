/** @type {import('next').NextConfig} */
const nextConfig = {
  // @xenova/transformers menjalankan onnxruntime-node — jangan di-bundle webpack
  serverExternalPackages: [
    "@xenova/transformers",
    "officeparser",
    "file-type",
    "web-push",
    "pdfkit",
  ],
  // Header keamanan dasar (CSP ketat tidak dipasang karena Next.js butuh
  // inline script; header ini mencegah clickjacking, sniffing, dll).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
