/**
 * LocalStorage management untuk Study Buddy
 */

import type { BuddySettings, BuddyStorage, ChatMessage } from './buddyTypes';

const STORAGE_KEY = 'eureka-study-buddy';

const DEFAULT_SETTINGS: BuddySettings = {
  enabled: false,
  character: 'fox',
  triggers: {
    pomodoro: true,
    chapterDone: true,
    idle: true,
    random: true,
    quizReminder: true,
  },
  timings: {
    pomodoroMinutes: 25,
    idleSeconds: 30,
    cooldownMinutes: 3,
  },
  animations: true,
};

export function getBuddyStorage(): BuddyStorage {
  if (typeof window === 'undefined') {
    return {
      settings: DEFAULT_SETTINGS,
      chatHistory: [],
      stats: {
        totalChats: 0,
        helpfulCount: 0,
        lastActiveDate: new Date().toISOString(),
      },
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return createDefaultStorage();
    
    const parsed = JSON.parse(stored) as Partial<BuddyStorage>;
    return {
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      chatHistory: parsed.chatHistory || [],
      stats: parsed.stats || {
        totalChats: 0,
        helpfulCount: 0,
        lastActiveDate: new Date().toISOString(),
      },
    };
  } catch {
    return createDefaultStorage();
  }
}

export function saveBuddyStorage(storage: BuddyStorage): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.error('Failed to save Study Buddy storage:', error);
  }
}

export function updateSettings(settings: Partial<BuddySettings>): void {
  const storage = getBuddyStorage();
  storage.settings = { ...storage.settings, ...settings };
  saveBuddyStorage(storage);
}

export function addChatMessage(message: ChatMessage): void {
  const storage = getBuddyStorage();
  storage.chatHistory.push(message);
  
  // Keep only last 20 messages
  if (storage.chatHistory.length > 20) {
    storage.chatHistory = storage.chatHistory.slice(-20);
  }
  
  storage.stats.totalChats++;
  storage.stats.lastActiveDate = new Date().toISOString();
  saveBuddyStorage(storage);
}

export function clearChatHistory(): void {
  const storage = getBuddyStorage();
  storage.chatHistory = [];
  saveBuddyStorage(storage);
}

function createDefaultStorage(): BuddyStorage {
  return {
    settings: DEFAULT_SETTINGS,
    chatHistory: [],
    stats: {
      totalChats: 0,
      helpfulCount: 0,
      lastActiveDate: new Date().toISOString(),
    },
  };
}
