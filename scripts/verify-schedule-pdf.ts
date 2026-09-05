import { buildSchedulePdfBuffer } from "@/lib/scheduleExport";

async function main() {
  const buf = await buildSchedulePdfBuffer({
    userName: "Rifty",
    entries: [
      { day: "Senin", start: "07:30", end: "09:00", subject: "Matematika", room: "R-12", color: "#0369A1" },
      { day: "Senin", start: "09:15", end: "10:45", subject: "Fisika", color: "#7C3AED" },
      { day: "Rabu", start: "10:00", end: "11:30", subject: "Bahasa Indonesia", color: "#047857" },
      { day: "Jumat", start: "08:00", end: "09:30", subject: "Biologi", color: "#B45309" },
    ],
    tasks: [
      { title: "PR Trigonometri hal 88", subject: "Matematika", dueDate: "2026-09-08", done: false },
      { title: "Esai fotosintesis", subject: "IPA", dueDate: "2026-09-10", done: false },
      { title: "Laporan praktikum", subject: "Biologi", dueDate: "2026-09-05", done: true },
    ],
  });
  const head = buf.subarray(0, 5).toString();
  console.log("header:", head, "| size:", buf.length, "bytes");
  console.log(head === "%PDF-" ? "PDF LOLOS" : "PDF GAGAL");
}
void main();
