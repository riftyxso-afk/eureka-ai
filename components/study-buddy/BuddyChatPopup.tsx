/**
 * Chat Popup untuk Study Buddy — interaktif:
 * - Saat pertama aktif (riwayat kosong), buddy bertanya konteks belajar
 *   lewat pertanyaan pilihan ganda (ask_context).
 * - Bubble "question" menampilkan tombol opsi yang bisa diketuk.
 * - Tombol Kuis → kuis percakapan 5 soal dengan penilaian langsung.
 * - Tampilan konsisten tema clay (terang/gelap).
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Loader2, Trash2, Sparkles, Check } from 'lucide-react';
import type { BuddyCharacter, BuddyState, ChatMessage } from '@/lib/study-buddy/buddyTypes';
import { getBuddyStorage, addChatMessage, clearChatHistory } from '@/lib/study-buddy/buddyStorage';
import { BUDDY_TEMPLATES } from '@/lib/study-buddy/buddyTemplates';
import { apiFetch } from '@/lib/apiClient';

interface BuddyQuestion {
  id: string;
  question: string;
  options: string[];
}

interface BuddyChatPopupProps {
  character: BuddyCharacter;
  initialMessage?: string;
  onClose: () => void;
  onStateChange: (state: BuddyState) => void;
}

export default function BuddyChatPopup({
  character,
  initialMessage,
  onClose,
  onStateChange,
}: BuddyChatPopupProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [askedContext, setAskedContext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const quizIdRef = useRef<string | null>(null);
  const template = BUDDY_TEMPLATES[character];

  const pushMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
    addChatMessage(msg);
  }, []);

  // Load chat history + auto tanya konteks saat riwayat kosong.
  useEffect(() => {
    const storage = getBuddyStorage();
    setMessages(storage.chatHistory);

    const start = async () => {
      if (storage.chatHistory.length > 0) return;
      if (initialMessage) {
        pushMessage({
          role: 'buddy',
          content: initialMessage,
          timestamp: Date.now(),
        });
      }
      setIsLoading(true);
      onStateChange('thinking');
      try {
        const res = await apiFetch('/api/study-buddy/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character, intent: 'ask_context' }),
        });
        const data = await res.json();
        if (data.reply) {
          pushMessage({
            role: 'buddy',
            content: data.reply,
            timestamp: Date.now(),
          });
        }
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          for (const q of data.questions as BuddyQuestion[]) {
            pushMessage({
              role: 'buddy',
              type: 'question',
              content: q.question,
              options: q.options,
              questionId: q.id,
              timestamp: Date.now(),
            });
          }
          setAskedContext(true);
        }
      } catch {
        // Gagal ask_context — popup tetap bisa dipakai.
      } finally {
        setIsLoading(false);
        onStateChange('idle');
      }
    };
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, initialMessage]);

  // Auto-scroll ke bawah.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    const text = inputValue.trim();
    pushMessage({ role: 'user', content: text, timestamp: Date.now() });
    setInputValue('');
    setIsLoading(true);
    onStateChange('thinking');

    try {
      const wantQuiz = /(^|\s)(kuis|quiz)(\s|$)/i.test(text);
      const res = await apiFetch('/api/study-buddy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character,
          message: text,
          history: messages.slice(-5),
          intent: wantQuiz ? 'quiz' : 'chat',
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      if (data.reply) {
        pushMessage({ role: 'buddy', content: data.reply, timestamp: Date.now() });
      }
      if (data.quizId) quizIdRef.current = data.quizId;
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        for (const q of data.questions as BuddyQuestion[]) {
          pushMessage({
            role: 'buddy',
            type: 'question',
            content: q.question,
            options: q.options,
            questionId: q.id,
            quizId: data.quizId ?? undefined,
            timestamp: Date.now(),
          });
        }
      }
      onStateChange('talking');
      setTimeout(() => onStateChange('idle'), 2000);
    } catch {
      pushMessage({
        role: 'buddy',
        content: 'Maaf, aku sedang mengalami masalah. Coba lagi nanti ya!',
        timestamp: Date.now(),
      });
      onStateChange('confused');
    } finally {
      setIsLoading(false);
    }
  };

  // Jawab bubble question (konteks atau kuis).
  const handleAnswer = async (msg: ChatMessage, option: string) => {
    if (isLoading) return;
    pushMessage({ role: 'user', content: option, timestamp: Date.now() });
    setIsLoading(true);
    onStateChange('thinking');

    try {
      const isQuiz = Boolean(msg.quizId && quizIdRef.current);
      const res = await apiFetch('/api/study-buddy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character,
          intent: isQuiz ? 'quiz' : 'ask_context',
          action: 'answer',
          questionId: msg.questionId,
          answer: option,
          quizId: isQuiz ? msg.quizId : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      if (data.reply) {
        pushMessage({ role: 'buddy', content: data.reply, timestamp: Date.now() });
      }
      if (data.next) {
        pushMessage({
          role: 'buddy',
          type: 'question',
          content: data.next.question,
          options: data.next.options,
          questionId: data.next.id,
          quizId: msg.quizId ?? undefined,
          timestamp: Date.now(),
        });
      }
      onStateChange('talking');
      setTimeout(() => onStateChange('idle'), 2000);
    } catch {
      pushMessage({
        role: 'buddy',
        content: 'Maaf, terjadi kesalahan. Coba lagi ya!',
        timestamp: Date.now(),
      });
      onStateChange('confused');
    } finally {
      setIsLoading(false);
    }
  };

  const startQuiz = async () => {
    if (isLoading) return;
    setIsLoading(true);
    onStateChange('thinking');
    try {
      const res = await apiFetch('/api/study-buddy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character, intent: 'quiz' }),
      });
      const data = await res.json();
      if (data.reply) {
        pushMessage({ role: 'buddy', content: data.reply, timestamp: Date.now() });
      }
      if (data.quizId) quizIdRef.current = data.quizId;
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        for (const q of data.questions as BuddyQuestion[]) {
          pushMessage({
            role: 'buddy',
            type: 'question',
            content: q.question,
            options: q.options,
            questionId: q.id,
            quizId: data.quizId ?? undefined,
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      pushMessage({
        role: 'buddy',
        content: 'Aku belum bisa buat kuis sekarang. Coba lagi nanti ya!',
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
      onStateChange('idle');
    }
  };

  const handleClearHistory = () => {
    clearChatHistory();
    setMessages([]);
    quizIdRef.current = null;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, x: 20, y: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: 20, y: 20 }}
      className="fixed inset-x-4 bottom-28 z-50 flex max-h-[70dvh] w-auto flex-col overflow-hidden rounded-clay-md border-2 border-clay-shadow/40 bg-clay-cream shadow-clay-lg sm:inset-x-auto sm:bottom-32 sm:right-6 sm:left-auto sm:h-[500px] sm:w-96 dark:border-clay-shadow/30 dark:bg-[#221F33]"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b border-clay-shadow/20 px-3 py-2.5 dark:border-white/10 sm:px-4 sm:py-3"
        style={{
          background: `linear-gradient(135deg, ${template.colors.primary}22, ${template.colors.primary}08)`,
        }}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-clay-btn sm:h-10 sm:w-10 sm:text-lg"
            style={{ backgroundColor: template.colors.primary }}
          >
            {character === 'fox' && '🦊'}
            {character === 'owl' && '🦉'}
            {character === 'cat' && '🐱'}
            {character === 'bear' && '🐻'}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-extrabold text-clay-dark sm:text-base dark:text-white">
              {template.name}
            </h3>
            <p className="truncate text-xs font-semibold text-clay-muted">
              {template.personality}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5 sm:gap-1">
          <button
            onClick={() => void startQuiz()}
            className="flex h-10 w-10 items-center justify-center rounded-clay-md text-clay-muted transition-colors hover:bg-clay-beige hover:text-clay-primary sm:h-9 sm:w-9"
            title="Mulai kuis"
            aria-label="Mulai kuis"
          >
            <Sparkles className="h-4 w-4" />
          </button>
          <button
            onClick={handleClearHistory}
            className="flex h-10 w-10 items-center justify-center rounded-clay-md text-clay-muted transition-colors hover:bg-clay-beige hover:text-red-500 sm:h-9 sm:w-9"
            title="Bersihkan chat"
            aria-label="Bersihkan chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-clay-md text-clay-muted transition-colors hover:bg-clay-beige sm:h-9 sm:w-9"
            aria-label="Tutup chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 sm:space-y-3 sm:p-4">
        {messages.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-sm font-extrabold text-clay-dark dark:text-white">
              Hai! Aku {template.name}
            </p>
            <p className="mt-2 text-xs font-semibold text-clay-muted">
              Tanya aku apa saja tentang pelajaranmu!
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.type === 'question' ? (
                <div className="max-w-[90%] rounded-clay-md border-2 border-clay-primary/30 bg-clay-primary/5 p-3 shadow-clay-sm sm:max-w-[85%]">
                  <p className="text-xs font-extrabold text-clay-dark sm:text-sm dark:text-white">
                    {msg.content}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(msg.options ?? []).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        disabled={isLoading}
                        onClick={() => void handleAnswer(msg, opt)}
                        className="flex items-center gap-1 rounded-clay-full border-2 border-clay-shadow/40 bg-clay-cream px-2.5 py-1.5 text-[11px] font-extrabold text-clay-dark transition-all duration-75 hover:border-clay-primary hover:text-clay-primary disabled:opacity-50 sm:text-xs dark:bg-[#2B2840] dark:text-white"
                      >
                        <Check size={11} className="text-clay-primary" />
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-clay-md px-3 py-2 text-xs font-semibold leading-relaxed sm:max-w-[80%] sm:px-4 sm:py-2.5 sm:text-sm ${
                    msg.role === 'user'
                      ? 'rounded-br-[6px] bg-clay-primary text-white shadow-clay-btn'
                      : 'rounded-bl-[6px] bg-clay-beige text-clay-dark shadow-clay-sm dark:bg-[#2B2840] dark:text-white'
                  }`}
                >
                  {msg.content}
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-clay-md bg-clay-beige px-4 py-2 shadow-clay-sm dark:bg-[#2B2840]">
              <Loader2 className="h-4 w-4 animate-spin text-clay-primary" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-clay-shadow/20 p-3 dark:border-white/10 sm:p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ketik pesan..."
            disabled={isLoading}
            className="min-w-0 flex-1 rounded-clay-full border-2 border-clay-shadow/40 bg-clay-inputBg px-3 py-2 text-xs font-semibold text-clay-dark shadow-clay-inset outline-none transition-colors focus:border-clay-primary disabled:opacity-50 sm:px-4 sm:text-sm dark:bg-[#2B2840] dark:text-white"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!inputValue.trim() || isLoading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-primary text-white shadow-clay-btn transition-all hover:brightness-110 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10"
            aria-label="Kirim pesan"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] font-bold text-clay-muted">
          Ketik "kuis" atau tap ✨ untuk kuis percakapan
        </p>
      </div>
    </motion.div>
  );
}
