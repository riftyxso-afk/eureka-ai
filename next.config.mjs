/** @type {import('next').NextConfig} */
const nextConfig = {
  // @xenova/transformers menjalankan onnxruntime-node — jangan di-bundle webpack
  serverExternalPackages: [
    "@xenova/transformers",
    "officeparser",
    "file-type",
    "web-push",
  ],
};

export default nextConfig;
