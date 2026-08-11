import type { Message } from "./types";

export const mockMessages: Message[] = [
  {
    id: "m1",
    role: "user",
    content: "Turunan dari f(x) = 3x² + 2x adalah?",
  },
  {
    id: "m2",
    role: "assistant",
    content:
      "Halo! Aku baca soal kamu. Menurut kamu, langkah pertama yang harus dilakukan untuk mencari turunan itu apa?",
  },
  {
    id: "m3",
    role: "user",
    content: "Pangkatnya diturunin?",
  },
  {
    id: "m4",
    role: "assistant",
    content:
      "Hampir! Di turunan, ada aturan khusus: Turunan dari xⁿ adalah n·xⁿ⁻¹. Coba kamu terapin aturan ini ke 3x². Turunan dari 3x² itu berapa?",
    toolCalls: [{ name: "Weakness Detector", status: "completed" }],
  },
];

export interface MockReply {
  tool: string | null;
  text: string;
}

export const replyBank: MockReply[] = [
  {
    tool: "Calculator",
    text: "Hmm, menarik! Kalau f(x) = 3x² + 2x, ingat aturannya: turunan dari xⁿ adalah n·xⁿ⁻¹. Coba terapkan ke suku pertama, 3x² — berapa hasilnya?",
  },
  {
    tool: "Weakness Detector",
    text: "Hampir! Kamu sudah benar menurunkan pangkat, tapi jangan lupa koefisiennya ikut dikalikan. Turunan dari 3x² adalah 3 × 2x = 6x. Sekarang coba suku keduanya: turunan dari 2x itu berapa?",
  },
  {
    tool: null,
    text: "EUREKA! 🎉 Tepat sekali! Kamu baru saja menyelesaikan turunan fungsi polinomial. Sekarang coba jelaskan dengan kata-katamu sendiri: kenapa turunan dari 2x bisa jadi 2?",
  },
];
