/** Cek live generateImageViaOpenAgentic → harus data URL base64 (bukan URL sementara). */
import { generateImageViaOpenAgentic, OPENAGENTIC_IMAGE_MODEL } from "../lib/image-gen";

async function main() {
  console.log("model:", OPENAGENTIC_IMAGE_MODEL);
  const dataUrl = await generateImageViaOpenAgentic("diagram siklus air sederhana gaya ilustrasi edukasi, latar terang");
  if (!dataUrl) { console.error("GAGAL: null"); process.exit(1); }
  const isData = dataUrl.startsWith("data:image/");
  const b64len = dataUrl.length;
  console.log("data URL:", isData, "| panjang:", b64len, "| ±", Math.round(b64len * 0.75 / 1024), "KB gambar");
  if (!isData || b64len < 10_000) { console.error("GAGAL: bukan data URL valid"); process.exit(1); }
  console.log("LOLOS");
}
void main();
