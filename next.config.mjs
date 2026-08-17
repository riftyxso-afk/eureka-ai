/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

// CSP "tanpa nonce" (pola resmi Next.js untuk app static-rendering):
// `script-src 'unsafe-inline'` diperlukan Next.js untuk inline flight
// scripts (RSC) pada halaman statis; seluruh sumber lain dibatasi ketat.
// Nonce-based CSP memaksa SEMUA halaman dynamic-render (terlalu invasif
// untuk aplikasi ini — dicatat sebagai keputusan di change security-hardening).
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' https: wss:${isDev ? " http://localhost:* http://127.0.0.1:*" : ""};
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-src https://challenges.cloudflare.com https://drive.google.com;
  frame-ancestors 'none';
  ${isDev ? "" : "upgrade-insecure-requests;"}
`;

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
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=()",
      },
    ];
    // HSTS hanya untuk produksi (HTTPS sudah wajib di Vercel).
    if (!isDev) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      });
    }
    return [
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(/\s{2,}/g, " ").trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;