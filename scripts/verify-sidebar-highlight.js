// Verifikasi highlight sidebar: item aktif harus punya kelas bg-clay-primary.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("console", (m) => { if (/error/i.test(m.type())) console.log("[console]", m.text().slice(0, 120)); });

  await page.goto("http://localhost:3000/dashboard/jadwal", { waitUntil: "networkidle", timeout: 90000 });

  const info = await page.evaluate(() => {
    const links = [...document.querySelectorAll('aside a[href^="/dashboard"]')];
    return links.map((a) => ({
      href: a.getAttribute("href"),
      text: (a.textContent || "").trim().slice(0, 18),
      active: a.className.includes("bg-clay-primary") && !a.className.includes("clay-primary/10"),
      ariaCurrent: a.getAttribute("aria-current"),
    }));
  });
  console.log(JSON.stringify(info, null, 1));
  const active = info.filter((i) => i.active);
  console.log(active.some((i) => i.href === "/dashboard/jadwal") ? "HIGHLIGHT LOLOS" : "HIGHLIGHT GAGAL");
  await browser.close();
})();
