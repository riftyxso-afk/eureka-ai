/**
 * Settings Page - Study Buddy Configuration
 */

'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Check } from 'lucide-react';
import Link from 'next/link';
import { getBuddyStorage, updateSettings } from '@/lib/study-buddy/buddyStorage';
import { BUDDY_TEMPLATES } from '@/lib/study-buddy/buddyTemplates';
import type { BuddySettings, BuddyCharacter } from '@/lib/study-buddy/buddyTypes';
import PixelArtAvatar from '@/components/study-buddy/PixelArtAvatar';

export default function SettingsPage() {
  const [settings, setSettings] = useState<BuddySettings | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const storage = getBuddyStorage();
    setSettings(storage.settings);
  }, []);

  const handleSave = () => {
    if (!settings) return;
    
    updateSettings(settings);
    setIsSaved(true);
    
    setTimeout(() => setIsSaved(false), 2000);
  };

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-clay-beige dark:bg-[#171526]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-clay-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-clay-beige dark:bg-[#171526]">
      {/* Header */}
      <div className="border-b-2 border-clay-shadow/20 bg-clay-cream/70 backdrop-blur-sm dark:bg-[#221F33]">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <Link
                href="/dashboard"
                className="p-2.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors touch-manipulation"
                aria-label="Kembali ke dashboard"
              >
                <ArrowLeft className="w-6 h-6 sm:w-5 sm:h-5" />
              </Link>
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl font-extrabold text-clay-dark sm:text-3xl dark:text-white">
                  Pengaturan Study Buddy
                </h1>
                <p className="mt-0.5 text-xs font-semibold text-clay-muted sm:mt-1 sm:text-sm">
                  Atur teman belajar interaktifmu
                </p>
              </div>
            </div>
            <button
              onClick={handleSave}
              className="btn-clay-primary flex w-full items-center justify-center gap-2 rounded-clay-md px-4 py-3 text-sm font-extrabold min-h-[44px] sm:w-auto sm:py-2"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="font-medium">Tersimpan</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="font-medium">Simpan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {/* Enable/Disable */}
        <div className="card-clay rounded-clay border-2 border-clay-shadow/40 p-3 sm:p-6 dark:bg-[#221F33]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex-1">
              <h2 className="text-base font-extrabold text-clay-dark sm:text-lg dark:text-white">
                Aktifkan Study Buddy
              </h2>
              <p className="mt-1 text-xs font-semibold text-clay-muted sm:text-sm">
                Teman belajar interaktif yang membantu kamu fokus dan memahami materi
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
              className={`relative inline-flex h-8 w-14 sm:h-6 sm:w-11 items-center rounded-full transition-colors touch-manipulation flex-shrink-0 ${
                settings.enabled ? 'bg-clay-primary' : 'bg-clay-shadow/40 dark:bg-[#3A3650]'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 sm:h-4 sm:w-4 transform rounded-full bg-clay-cream transition-transform ${
                  settings.enabled ? 'translate-x-7 sm:translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Character Selection */}
        <div className="card-clay rounded-clay border-2 border-clay-shadow/40 p-3 sm:p-6 dark:bg-[#221F33]">
          <h2 className="mb-3 text-base font-extrabold text-clay-dark sm:mb-4 sm:text-lg dark:text-white">
            Pilih Karakter
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {Object.entries(BUDDY_TEMPLATES).map(([id, template]) => (
              <button
                key={id}
                onClick={() => setSettings({ ...settings, character: id as BuddyCharacter })}
                className={`p-3 sm:p-4 rounded-xl border-2 transition-all hover:scale-105 touch-manipulation min-h-[120px] sm:min-h-[140px] ${
                  settings.character === id
                    ? 'border-clay-primary bg-clay-primary/10'
                    : 'border-clay-shadow/40 hover:border-clay-primary/50 dark:border-white/10'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                    <PixelArtAvatar
                      character={id as BuddyCharacter}
                      state="idle"
                      size={64}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-extrabold text-clay-dark sm:text-base dark:text-white">
                      {template.name}
                    </p>
                    <p className="line-clamp-2 text-xs font-semibold text-clay-muted">
                      {template.personality}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Trigger Settings */}
        <div className="card-clay rounded-clay border-2 border-clay-shadow/40 p-3 sm:p-6 dark:bg-[#221F33]">
          <h2 className="mb-3 text-base font-extrabold text-clay-dark sm:mb-4 sm:text-lg dark:text-white">
            Kapan Buddy Muncul
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {/* Pomodoro */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex-1">
                <p className="text-sm font-bold text-clay-dark sm:text-base dark:text-white">Pomodoro Timer</p>
                <p className="text-xs font-semibold text-clay-muted sm:text-sm">
                  Ingatkan istirahat setiap {settings.timings.pomodoroMinutes} menit
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    triggers: { ...settings.triggers, pomodoro: !settings.triggers.pomodoro },
                  })
                }
                className={`relative inline-flex h-8 w-14 sm:h-6 sm:w-11 items-center rounded-full transition-colors touch-manipulation flex-shrink-0 ${
                  settings.triggers.pomodoro ? 'bg-clay-primary' : 'bg-clay-shadow/40 dark:bg-[#3A3650]'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 sm:h-4 sm:w-4 transform rounded-full bg-clay-cream transition-transform ${
                    settings.triggers.pomodoro ? 'translate-x-7 sm:translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Chapter Done */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex-1">
                <p className="text-sm font-bold text-clay-dark sm:text-base dark:text-white">Selesai Bab</p>
                <p className="text-xs font-semibold text-clay-muted sm:text-sm">
                  Review setelah menyelesaikan satu bab
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    triggers: { ...settings.triggers, chapterDone: !settings.triggers.chapterDone },
                  })
                }
                className={`relative inline-flex h-8 w-14 sm:h-6 sm:w-11 items-center rounded-full transition-colors touch-manipulation flex-shrink-0 ${
                  settings.triggers.chapterDone ? 'bg-clay-primary' : 'bg-clay-shadow/40 dark:bg-[#3A3650]'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 sm:h-4 sm:w-4 transform rounded-full bg-clay-cream transition-transform ${
                    settings.triggers.chapterDone ? 'translate-x-7 sm:translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Idle Detection */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex-1">
                <p className="text-sm font-bold text-clay-dark sm:text-base dark:text-white">Deteksi Idle</p>
                <p className="text-xs font-semibold text-clay-muted sm:text-sm">
                  Tanya kalau kamu stuck lebih dari {settings.timings.idleSeconds} detik
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    triggers: { ...settings.triggers, idle: !settings.triggers.idle },
                  })
                }
                className={`relative inline-flex h-8 w-14 sm:h-6 sm:w-11 items-center rounded-full transition-colors touch-manipulation flex-shrink-0 ${
                  settings.triggers.idle ? 'bg-clay-primary' : 'bg-clay-shadow/40 dark:bg-[#3A3650]'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 sm:h-4 sm:w-4 transform rounded-full bg-clay-cream transition-transform ${
                    settings.triggers.idle ? 'translate-x-7 sm:translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Random Engagement */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex-1">
                <p className="text-sm font-bold text-clay-dark sm:text-base dark:text-white">Engagement Acak</p>
                <p className="text-xs font-semibold text-clay-muted sm:text-sm">
                  Buddy menyapa secara random untuk tetap engaged
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    triggers: { ...settings.triggers, random: !settings.triggers.random },
                  })
                }
                className={`relative inline-flex h-8 w-14 sm:h-6 sm:w-11 items-center rounded-full transition-colors touch-manipulation flex-shrink-0 ${
                  settings.triggers.random ? 'bg-clay-primary' : 'bg-clay-shadow/40 dark:bg-[#3A3650]'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 sm:h-4 sm:w-4 transform rounded-full bg-clay-cream transition-transform ${
                    settings.triggers.random ? 'translate-x-7 sm:translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Quiz Reminder */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex-1">
                <p className="text-sm font-bold text-clay-dark sm:text-base dark:text-white">Reminder Quiz</p>
                <p className="text-xs font-semibold text-clay-muted sm:text-sm">
                  Ingatkan untuk latihan soal
                </p>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    triggers: { ...settings.triggers, quizReminder: !settings.triggers.quizReminder },
                  })
                }
                className={`relative inline-flex h-8 w-14 sm:h-6 sm:w-11 items-center rounded-full transition-colors touch-manipulation flex-shrink-0 ${
                  settings.triggers.quizReminder ? 'bg-clay-primary' : 'bg-clay-shadow/40 dark:bg-[#3A3650]'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 sm:h-4 sm:w-4 transform rounded-full bg-clay-cream transition-transform ${
                    settings.triggers.quizReminder ? 'translate-x-7 sm:translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Timing Settings */}
        <div className="card-clay rounded-clay border-2 border-clay-shadow/40 p-3 sm:p-6 dark:bg-[#221F33]">
          <h2 className="mb-3 text-base font-extrabold text-clay-dark sm:mb-4 sm:text-lg dark:text-white">
            Pengaturan Waktu
          </h2>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="mb-2 block text-xs font-extrabold text-clay-dark sm:text-sm dark:text-white">
                Durasi Pomodoro (menit)
              </label>
              <input
                type="number"
                min="5"
                max="60"
                value={settings.timings.pomodoroMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    timings: { ...settings.timings, pomodoroMinutes: parseInt(e.target.value) },
                  })
                }
                className="w-full rounded-clay-md border-2 border-clay-shadow/40 bg-clay-inputBg px-3 py-2 text-sm font-bold text-clay-dark shadow-clay-inset outline-none transition-colors focus:border-clay-primary sm:px-4 dark:bg-[#2B2840] dark:text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-extrabold text-clay-dark sm:text-sm dark:text-white">
                Deteksi Idle (detik)
              </label>
              <input
                type="number"
                min="10"
                max="120"
                value={settings.timings.idleSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    timings: { ...settings.timings, idleSeconds: parseInt(e.target.value) },
                  })
                }
                className="w-full rounded-clay-md border-2 border-clay-shadow/40 bg-clay-inputBg px-3 py-2 text-sm font-bold text-clay-dark shadow-clay-inset outline-none transition-colors focus:border-clay-primary sm:px-4 dark:bg-[#2B2840] dark:text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-extrabold text-clay-dark sm:text-sm dark:text-white">
                Cooldown antar notifikasi (menit)
              </label>
              <input
                type="number"
                min="1"
                max="15"
                value={settings.timings.cooldownMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    timings: { ...settings.timings, cooldownMinutes: parseInt(e.target.value) },
                  })
                }
                className="w-full rounded-clay-md border-2 border-clay-shadow/40 bg-clay-inputBg px-3 py-2 text-sm font-bold text-clay-dark shadow-clay-inset outline-none transition-colors focus:border-clay-primary sm:px-4 dark:bg-[#2B2840] dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Animations */}
        <div className="card-clay rounded-clay border-2 border-clay-shadow/40 p-3 sm:p-6 dark:bg-[#221F33]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex-1">
              <h2 className="text-base font-extrabold text-clay-dark sm:text-lg dark:text-white">Animasi</h2>
              <p className="mt-1 text-xs font-semibold text-clay-muted sm:text-sm">
                Aktifkan animasi pixel art
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, animations: !settings.animations })}
              className={`relative inline-flex h-8 w-14 sm:h-6 sm:w-11 items-center rounded-full transition-colors touch-manipulation flex-shrink-0 ${
                settings.animations ? 'bg-clay-primary' : 'bg-clay-shadow/40 dark:bg-[#3A3650]'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 sm:h-4 sm:w-4 transform rounded-full bg-clay-cream transition-transform ${
                  settings.animations ? 'translate-x-7 sm:translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
