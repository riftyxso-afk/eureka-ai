/**
 * Foto profil user (avatar).
 *
 * Disimpan sebagai data URL (base64, ~256px, JPEG) di localStorage agar
 * langsung tampil di mana pun tanpa menunggu server. Nilai yang sama juga
 * dikirim ke profile_data.avatarUrl lewat PUT /api/profile agar tahan
 * pindah perangkat.
 */
const AVATAR_KEY = "eureka_avatar";

export function getAvatar(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AVATAR_KEY);
    return raw && raw.startsWith("data:image/") ? raw : null;
  } catch {
    return null;
  }
}

export function setAvatar(dataUrl: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (dataUrl) window.localStorage.setItem(AVATAR_KEY, dataUrl);
    else window.localStorage.removeItem(AVATAR_KEY);
  } catch {
    // abaikan (file terlalu besar untuk quota localStorage)
  }
}

/** Ambil foto dari File → resize ke 256px → data URL JPEG. */
export function fileToAvatarDataUrl(
  file: File,
  maxSize = 256
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("File bukan gambar valid."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas tidak didukung."));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
