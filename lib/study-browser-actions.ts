import { z } from "zod";

export const browserStepSchema = z.object({
  action: z.enum(["navigate", "click", "type", "scroll", "back", "done"]).optional(),
  url: z.string().max(2000).nullable().optional(),
  ref: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).optional(),
  text: z.string().trim().min(1).max(160).optional(),
  direction: z.enum(["up", "down"]).optional(),
});

export type BrowserControl = { role: string; label: string; ref: string; href?: string };

export function browserControls(snapshot: string): BrowserControl[] {
  const controls: BrowserControl[] = [];
  for (const line of snapshot.split("\n")) {
    const match = line.match(/- (link|button|textbox|searchbox|combobox|tab) "([^"]*)" \[ref=([A-Za-z0-9_-]+)\](.*)/);
    if (match) controls.push({ role: match[1], label: match[2], ref: match[3], href: match[4].match(/href="([^"]+)"/)?.[1] });
  }
  return controls.slice(0, 120);
}

/** These steps browse existing content. They cannot post, pay, change accounts or edit user data. */
export function canBrowseControl(control: BrowserControl) {
  const value = control.label + " " + (control.href || "");
  if (/delete|remove|hapus|logout|sign.?out|sign.?in|log.?in|checkout|purchase|payment|subscribe|unsubscribe|pay\b|bayar|kirim|send\b|upload|publish|save\b|simpan|confirm|setujui|accept|agree|izin/i.test(value)) return false;
  if (control.role === "link") return Boolean(control.href);
  return ["button", "tab"].includes(control.role)
    && /menu|navigation|leaderboard|ranking|peringkat|model|comparison|compare|banding|intelligence|benchmark|filter|search|cari|urut|sort|expand|collapse|show|more|next|previous|lanjut|back|kembali|detail|overview|ringkasan|read|baca|article|artikel|tab|close|tutup|halaman|page|dropdown|video|paper|publication|journal|berita|news|learn|belajar|results|hasil|view|lihat|open|buka|home|beranda/i.test(control.label);
}

export function canTypeSearch(control: BrowserControl, text: string, userMessages: string[]) {
  return ["textbox", "searchbox", "combobox"].includes(control.role)
    && /search|filter|cari|pencarian|telusur/i.test(control.label)
    && !/[\r\n\x00-\x1f]|[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)
    && userMessages.some(message => message.toLowerCase().includes(text.toLowerCase()));
}
