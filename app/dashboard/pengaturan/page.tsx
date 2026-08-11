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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Pengaturan Study Buddy
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Atur teman belajar interaktifmu
                </p>
              </div>
            </div>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  Tersimpan
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Simpan
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Enable/Disable */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Aktifkan Study Buddy
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Teman belajar interaktif yang membantu kamu fokus dan memahami materi
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Character Selection */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Pilih Karakter
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(BUDDY_TEMPLATES).map(([id, template]) => (
              <button
                key={id}
                onClick={() => setSettings({ ...settings, character: id as BuddyCharacter })}
                className={`p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                  settings.character === id
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 dark:border-gray-800 hover:border-primary/50'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 flex items-center justify-center">
                    <PixelArtAvatar
                      character={id as BuddyCharacter}
                      state="idle"
                      size={64}
                    />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {template.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {template.personality}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Trigger Settings */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Kapan Buddy Muncul
          </h2>
          <div className="space-y-4">
            {/* Pomodoro */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Pomodoro Timer</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.triggers.pomodoro ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.triggers.pomodoro ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Chapter Done */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Selesai Bab</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.triggers.chapterDone ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.triggers.chapterDone ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Idle Detection */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Deteksi Idle</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.triggers.idle ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.triggers.idle ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Random Engagement */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Engagement Acak</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.triggers.random ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.triggers.random ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Quiz Reminder */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Reminder Quiz</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.triggers.quizReminder ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.triggers.quizReminder ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Timing Settings */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Pengaturan Waktu
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Animations */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Animasi</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Aktifkan animasi pixel art
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, animations: !settings.animations })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.animations ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.animations ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
