/**
 * API Route untuk Study Buddy Chat
 *
 * Intent:
 * - "chat" (default): obrolan bebas via OpenAgentic (perilaku lama).
 * - "ask_context": buddy bertanya konteks belajar (target, mapel, kesulitan)
 *   lewat 2-3 pertanyaan pilihan ganda — jawaban disimpan di Map in-memory.
 * - "quiz": buddy membuat kuis percakapan 5 soal pilihan ganda; jawaban user
 *   dinilai langsung (action "answer"), penjelasan + skor akhir ditampilkan.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { BuddyCharacter, ChatMessage } from '@/lib/study-buddy/buddyTypes';
import { BUDDY_TEMPLATES } from '@/lib/study-buddy/buddyTemplates';
import { requireAuth } from '@/lib/assistant/auth';
import { AI_SAFETY_GUARDRAIL } from '@/lib/prompts/safety';
import { aiChatJson, extractJsonObject, hasAiKey } from '@/lib/ai';

interface BuddyQuestion {
  id: string;
  question: string;
  options: string[];
  /** Indeks jawaban benar — hanya untuk kuis (tidak dikirim ke klien). */
  answer?: number;
}

interface QuizState {
  character: BuddyCharacter;
  questions: BuddyQuestion[];
  index: number;
  score: number;
  total: number;
}

/** State kuis in-memory (ephemeral per sesi; skor tidak dipersistensikan). */
const QUIZ_STATE = new Map<string, QuizState>();
/** Konteks belajar yang dikumpulkan dari ask_context per karakter. */
const BUDDY_CONTEXT = new Map<string, { target?: string; subject?: string; difficulty?: string }>();

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function generateContextQuestions(
  character: BuddyCharacter
): Promise<{ reply: string; questions: BuddyQuestion[] }> {
  const parsed = await aiChatJson<{ questions?: { q?: unknown; options?: unknown[] }[] }>(
    {
      system:
        'Kamu adalah teman belajar yang ramah. Buat pertanyaan untuk mengenal kebutuhan belajar pengguna. Jawab HANYA JSON.',
      user: `Buat 3 pertanyaan pilihan ganda singkat (bahasa Indonesia) untuk mengenal kebutuhan belajar: (1) target belajar, (2) mata pelajaran favorit/prioritas, (3) tingkat kesulitan yang diinginkan. Tiap pertanyaan 3 opsi.\n\nOutput JSON: {"questions": [{"q": "...", "options": ["A", "B", "C"]}]}`,
      json: true,
      maxTokens: 500,
      temperature: 0.4,
    },
    (raw) =>
      extractJsonObject<{ questions?: { q?: unknown; options?: unknown[] }[] }>(raw)
  );
  const questions = (Array.isArray(parsed?.questions) ? parsed.questions : [])
    .filter(
      (x): x is { q: unknown; options: unknown[] } =>
        !!x &&
        typeof x.q === 'string' &&
        Array.isArray(x.options) &&
        x.options.length >= 2
    )
    .map((x, i) => ({
      id: `ctx${i + 1}`,
      question: String(x.q).trim().slice(0, 200),
      options: x.options.slice(0, 4).map((o) => String(o).trim().slice(0, 100)),
    }))
    .slice(0, 3);

  return {
    reply: 'Sebelum mulai, aku ingin kenalan dulu biar belajarmu makin pas ✨',
    questions,
  };
}

async function startQuiz(
  character: BuddyCharacter
): Promise<{ reply: string; quizId?: string; questions?: BuddyQuestion[] }> {
  const parsed = await aiChatJson<{
    questions?: { q?: unknown; options?: unknown[]; answer?: unknown }[];
  }>(
    {
      system:
        'Kamu adalah pembuat kuis belajar untuk siswa. Buat 5 soal pilihan ganda sederhana yang bisa dijawab dari pelajaran umum. Jawab HANYA JSON.',
      user: `Buat 5 soal pilihan ganda (bahasa Indonesia) dengan 4 opsi masing-masing dan tandai jawaban benar (indeks 0-3). Variasikan topik (matematika, IPA, bahasa) dan tingkatkan kesulitan bertahap.\n\nOutput JSON: {"questions": [{"q": "...", "options": ["A","B","C","D"], "answer": 0}]}`,
      json: true,
      maxTokens: 1200,
      temperature: 0.6,
    },
    (raw) =>
      extractJsonObject<{
        questions?: { q?: unknown; options?: unknown[]; answer?: unknown }[];
      }>(raw)
  );
  const questions = (Array.isArray(parsed?.questions) ? parsed.questions : [])
    .filter(
      (x): x is { q: unknown; options: unknown[]; answer?: unknown } =>
        !!x &&
        typeof x.q === 'string' &&
        Array.isArray(x.options) &&
        x.options.length >= 2 &&
        typeof x.answer === 'number'
    )
    .map((x, i) => ({
      id: `quiz${i + 1}`,
      question: String(x.q).trim().slice(0, 250),
      options: x.options.slice(0, 4).map((o) => String(o).trim().slice(0, 120)),
      answer: Math.min(Math.max(Number(x.answer), 0), 3),
    }))
    .slice(0, 5);

  if (questions.length === 0) {
    throw new Error('AI tidak menghasilkan soal kuis.');
  }

  const quizId = makeId();
  QUIZ_STATE.set(quizId, {
    character,
    questions,
    index: 0,
    score: 0,
    total: questions.length,
  });
  return {
    reply: `Ayo kuis! ${questions.length} soal, jawab satu per satu ya 💪`,
    quizId,
    questions: [questions[0]],
  };
}

function answerQuiz(
  quizId: string,
  questionId: string,
  answer: string
): { reply: string; next?: BuddyQuestion; done?: boolean; score?: number } {
  const state = QUIZ_STATE.get(quizId);
  if (!state) {
    return { reply: 'Kuis sudah berakhir. Ketik "kuis" untuk mulai lagi ya!' };
  }

  const current = state.questions[state.index];
  if (!current || current.id !== questionId) {
    return { reply: 'Hmm, soal itu sudah lewat. Lanjut ke soal berikutnya ya.' };
  }

  const chosen = answer.trim();
  const correct = current.options[current.answer ?? 0] ?? '';
  const isRight = chosen === correct;
  if (isRight) state.score += 1;

  state.index += 1;
  const explanation = isRight
    ? `Benar! 🎉 ${current.question} — jawabannya memang ${correct}.`
    : `Kurang tepat 🙈 Jawaban yang benar: ${correct}. ${current.question}`;

  if (state.index >= state.total) {
    const score = state.score;
    const total = state.total;
    QUIZ_STATE.delete(quizId);
    return {
      reply: `${explanation}\n\nKuis selesai! Skormu ${score}/${total} ${
        score === total ? '— sempurna! 🏆' : score >= total * 0.6 ? '— bagus! 👍' : '— ayo latihan lagi! 💪'
      }`,
      done: true,
      score,
    };
  }

  const next = state.questions[state.index];
  return { reply: explanation, next };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const body = (await req.json().catch(() => null)) as {
      character?: unknown;
      message?: unknown;
      history?: unknown;
      intent?: unknown;
      action?: unknown;
      questionId?: unknown;
      answer?: unknown;
      quizId?: unknown;
    } | null;

    const character = String(body?.character ?? '').trim() as BuddyCharacter;
    const message = String(body?.message ?? '').trim();
    const intent = String(body?.intent ?? 'chat').trim();
    const action = String(body?.action ?? '').trim();
    const history = Array.isArray(body?.history) ? body.history : [];
    const questionId = String(body?.questionId ?? '').trim();
    const answer = String(body?.answer ?? '').trim();
    const quizId = String(body?.quizId ?? '').trim();

    if (!character || !BUDDY_TEMPLATES[character]) {
      return NextResponse.json({ error: 'Karakter tidak valid' }, { status: 400 });
    }

    // ── Intent: kuis ─────────────────────────────────────────────
    if (intent === 'quiz' && action === 'answer' && quizId && questionId && answer) {
      return NextResponse.json(answerQuiz(quizId, questionId, answer));
    }
    if (intent === 'quiz') {
      const result = await startQuiz(character);
      return NextResponse.json(result);
    }

    // ── Intent: tanya konteks belajar ────────────────────────────
    if (intent === 'ask_context') {
      if (action === 'answer' && questionId && answer) {
        // Simpan jawaban konteks (per karakter).
        const ctx = BUDDY_CONTEXT.get(character) ?? {};
        if (questionId === 'ctx1') ctx.target = answer;
        if (questionId === 'ctx2') ctx.subject = answer;
        if (questionId === 'ctx3') ctx.difficulty = answer;
        BUDDY_CONTEXT.set(character, ctx);
        const answered = Object.keys(ctx).length;
        return NextResponse.json({
          reply:
            answered >= 3
              ? `Siap! Aku catat ya: target "${ctx.target ?? '-'}", mapel "${ctx.subject ?? '-'}", level "${ctx.difficulty ?? '-'}". Mulai aja — tanya apa pun atau minta kuis! 🚀`
              : 'Catat ya! Lanjut pertanyaan berikutnya 👇',
        });
      }
      const { reply, questions } = await generateContextQuestions(character);
      return NextResponse.json({ reply, questions });
    }

    // ── Intent default: chat bebas (perilaku lama) ────────────────
    if (!message) {
      return NextResponse.json({ error: 'Pesan kosong' }, { status: 400 });
    }
    const template = BUDDY_TEMPLATES[character];
    const savedCtx = BUDDY_CONTEXT.get(character);
    const contextHint = savedCtx
      ? `\n\nKonteks belajar pengguna (dari jawaban sebelumnya): target="${savedCtx.target ?? '-'}", mapel="${savedCtx.subject ?? '-'}", kesulitan="${savedCtx.difficulty ?? '-'}". Sesuaikan bantuan dengan konteks ini.`
      : '';

    const systemPrompt = `Kamu adalah ${template.name}, seekor ${character} yang menjadi teman belajar interaktif.
Kepribadianmu: ${template.personality}

Peranmu:
- Membantu user memahami materi pelajaran dengan cara yang menyenangkan
- Memberikan motivasi dan dukungan dalam belajar
- Menjelaskan konsep yang sulit dengan analogi sederhana
- Mengajukan pertanyaan untuk mengecek pemahaman
- Selalu positif, ramah, dan supportive${contextHint}

Gaya bicara:
- Gunakan bahasa Indonesia yang santai tapi sopan
- Gunakan emoji sesekali (tidak berlebihan)
- Buat jawaban singkat dan mudah dipahami (max 3-4 kalimat)
- Jika user bertanya tentang materi, berikan penjelasan yang jelas dengan contoh

PENTING: Jangan terlalu panjang! Maksimal 3-4 kalimat per response.

${AI_SAFETY_GUARDRAIL}`;

    const messages: { role: 'system' | 'assistant' | 'user'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];
    if (history.length > 0) {
      (history as ChatMessage[]).forEach((m) => {
        if (m && typeof m.content === 'string' && m.type !== 'question') {
          messages.push({
            role: m.role === 'buddy' ? 'assistant' : 'user',
            content: m.content,
          });
        }
      });
    }
    messages.push({ role: 'user', content: message });

    if (hasAiKey()) {
      // Prioritas: pakai pipeline AI yang sudah ada (AIMurah/OpenAI-compatible).
      const { aiChat } = await import('@/lib/ai');
      const res = await aiChat({
        system: systemPrompt,
        user: messages
          .filter((m) => m.role !== 'system')
          .map((m) => `${m.role === 'assistant' ? 'Eureka' : 'User'}: ${m.content}`)
          .join('\n'),
        maxTokens: 300,
        temperature: 0.8,
      });
      return NextResponse.json({ reply: res.slice(0, 800) });
    }

    // Fallback OpenAgentic (tanpa key AI lokal).
    const response = await fetch('https://api.openagentic.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAGENTIC_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.8,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error('AI API request failed');
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content || 'Maaf, aku tidak bisa menjawab sekarang.';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Study Buddy chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat', reply: 'Maaf, terjadi kesalahan. Coba lagi ya!' },
      { status: 500 }
    );
  }
}
