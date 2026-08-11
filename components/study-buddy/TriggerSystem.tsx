/**
 * Trigger system untuk Study Buddy
 * Handles Pomodoro, idle detection, chapter completion, quiz reminders
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getBuddyStorage } from '@/lib/study-buddy/buddyStorage';
import type { TriggerType } from '@/lib/study-buddy/buddyTypes';

interface TriggerSystemProps {
  onTrigger: (type: TriggerType, message: string) => void;
}

export default function TriggerSystem({ onTrigger }: TriggerSystemProps) {
  const pomodoroTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const idleTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const randomTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const cooldownRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(Date.now());

  // Check if we're in cooldown period
  const isInCooldown = useCallback(() => {
    const storage = getBuddyStorage();
    const cooldownMs = storage.settings.timings.cooldownMinutes * 60 * 1000;
    return Date.now() - cooldownRef.current < cooldownMs;
  }, []);

  // Trigger with cooldown protection
  const triggerWithCooldown = useCallback((type: TriggerType, message: string) => {
    if (isInCooldown()) return;
    
    cooldownRef.current = Date.now();
    onTrigger(type, message);
  }, [isInCooldown, onTrigger]);

  // Pomodoro Timer Trigger
  useEffect(() => {
    const storage = getBuddyStorage();
    if (!storage.settings.enabled || !storage.settings.triggers.pomodoro) return;

    const pomodoroMs = storage.settings.timings.pomodoroMinutes * 60 * 1000;

    pomodoroTimerRef.current = setInterval(() => {
      const messages = [
        'Waktunya istirahat sebentar! Sudah belajar ' + storage.settings.timings.pomodoroMinutes + ' menit nih 😊',
        'Bagus! Kamu sudah fokus ' + storage.settings.timings.pomodoroMinutes + ' menit. Mau istirahat dulu?',
        'Pomodoro selesai! Gimana? Butuh bantuan dengan materi yang baru dipelajari?',
      ];
      
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      triggerWithCooldown('pomodoro', randomMessage);
    }, pomodoroMs);

    return () => {
      if (pomodoroTimerRef.current) {
        clearInterval(pomodoroTimerRef.current);
      }
    };
  }, [triggerWithCooldown]);

  // Idle Detection Trigger
  useEffect(() => {
    const storage = getBuddyStorage();
    if (!storage.settings.enabled || !storage.settings.triggers.idle) return;

    const idleSeconds = storage.settings.timings.idleSeconds;

    const checkIdle = () => {
      const idleDuration = (Date.now() - lastActivityRef.current) / 1000;
      
      if (idleDuration >= idleSeconds) {
        const messages = [
          'Hei, apa kamu stuck di materi ini? Mau aku bantu jelaskan?',
          'Kelihatannya kamu berhenti sebentar. Ada yang bikin bingung?',
          'Butuh bantuan? Aku siap membantu kalau ada yang kurang jelas!',
        ];
        
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        triggerWithCooldown('idle', randomMessage);
        lastActivityRef.current = Date.now(); // Reset to avoid repeated triggers
      }
    };

    // Check idle every 10 seconds
    idleTimerRef.current = setInterval(checkIdle, 10000);

    // Track user activity
    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('scroll', resetActivity);
    window.addEventListener('click', resetActivity);

    return () => {
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current);
      }
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('scroll', resetActivity);
      window.removeEventListener('click', resetActivity);
    };
  }, [triggerWithCooldown]);

  // Random Engagement Trigger
  useEffect(() => {
    const storage = getBuddyStorage();
    if (!storage.settings.enabled || !storage.settings.triggers.random) return;

    const scheduleRandomTrigger = () => {
      // Random between 10-20 minutes
      const randomMs = (10 + Math.random() * 10) * 60 * 1000;

      randomTimerRef.current = setTimeout(() => {
        const messages = [
          'Hei! Sudah paham dengan materi yang sedang dipelajari?',
          'Gimana? Ada pertanyaan tentang topik ini?',
          'Mau aku buatkan ringkasan dari yang sudah kamu pelajari?',
          'Yuk kita review! Apa hal paling penting yang udah kamu pelajari hari ini?',
        ];
        
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        triggerWithCooldown('random', randomMessage);
        
        // Schedule next random trigger
        scheduleRandomTrigger();
      }, randomMs);
    };

    scheduleRandomTrigger();

    return () => {
      if (randomTimerRef.current) {
        clearTimeout(randomTimerRef.current);
      }
    };
  }, [triggerWithCooldown]);

  // This component doesn't render anything
  return null;
}

// Export functions to trigger manually from other components
export function triggerChapterComplete(onTrigger: (type: TriggerType, message: string) => void) {
  const messages = [
    'Selamat! Kamu sudah selesai chapter ini! Mau kita review poin-poin pentingnya?',
    'Bagus! Chapter selesai! Aku bisa buatkan quiz kalau mau test pemahamanmu.',
    'Chapter selesai! Gimana? Ada yang masih bikin bingung?',
  ];
  
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  onTrigger('chapter_complete', randomMessage);
}

export function triggerQuizReminder(onTrigger: (type: TriggerType, message: string) => void) {
  const messages = [
    'Sudah lama tidak latihan soal nih! Mau aku buatkan quiz?',
    'Waktunya test pemahaman! Siap quiz sekarang?',
    'Hei! Mau coba quiz untuk materi yang udah dipelajari?',
  ];
  
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  onTrigger('quiz_reminder', randomMessage);
}
